"""Local HTTP API for 4-stem Demucs separation and the optional built web app."""

import asyncio
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from functools import lru_cache
from importlib.util import find_spec
from inspect import signature
import json
import math
import os
from pathlib import Path
import platform
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
from threading import Event, Lock
import time
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

HERE = Path(__file__).resolve().parent
MODEL = "htdemucs"
STEMS = ("vocals", "drums", "bass", "other")
Stem = Literal["vocals", "drums", "bass", "other"]
MAX_UPLOAD = 150 * 1024 * 1024
MAX_SECONDS = 600
AUDIO_FORMATS = "mp3,wav,mov,aac,flac,ogg,matroska,webm,aiff,asf"
RESULT_TTL = 3600
HOST = os.getenv("STEM_HOST", "0.0.0.0")
PORT = int(os.getenv("STEM_PORT", "8765"))
ACCESS_KEY = os.getenv("STEM_ACCESS_KEY") or secrets.token_urlsafe(16)


def allowed_origins():
    configured = os.getenv("STEM_ALLOWED_ORIGINS", "")
    origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
    for value in configured.split(","):
        origin = value.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlsplit(origin)
        if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.path or parsed.query or parsed.fragment:
            raise ValueError("STEM_ALLOWED_ORIGINS requires exact HTTP(S) origins separated by commas")
        origins.add(origin)
    return sorted(origins)


ORIGINS = allowed_origins()


@lru_cache(maxsize=1)
def hardware():
    """Report the preferred accelerator available in this PyTorch installation."""
    cpu = platform.processor() or platform.machine() or "CPU"
    if find_spec("torch") is None:
        return "cpu", cpu
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda", torch.cuda.get_device_name(0)
        if sys.platform == "darwin" and platform.machine() == "arm64" and torch.backends.mps.is_available():
            try:
                result = subprocess.run(
                    ["sysctl", "-n", "machdep.cpu.brand_string"],
                    capture_output=True, text=True, check=False, timeout=3,
                )
                name = result.stdout.strip()
            except (OSError, subprocess.SubprocessError):
                name = ""
            return "mps", name or "Apple Silicon (MPS)"
    except (ImportError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Hardware probe: {error}", file=sys.stderr, flush=True)
    return "cpu", cpu


def missing_dependencies():
    missing = [name for name in ("torch", "torchaudio", "demucs", "soundfile") if find_spec(name) is None]
    missing.extend(name for name in ("ffmpeg", "ffprobe") if shutil.which(name) is None)
    return missing


@dataclass
class Job:
    key: UUID
    folder: Path
    device: str
    status: str = "uploading"
    stage: str = "uploading"
    progress: int = 0
    error: str | None = None
    expires: float = float("inf")
    stop: Event = field(default_factory=Event)
    lock: Lock = field(default_factory=Lock)
    process: subprocess.Popen | None = None

    @property
    def upload(self):
        return self.folder / "upload.audio"

    @property
    def source(self):
        return self.folder / "input.wav"

    def update(self, **values):
        with self.lock:
            for key, value in values.items():
                setattr(self, key, value)

    def output(self, stem):
        return self.folder / MODEL / self.source.stem / f"{stem}.wav"

    def snapshot(self):
        with self.lock:
            return {
                "id": str(self.key),
                "status": self.status,
                "stage": self.stage,
                "progress": self.progress,
                "device": self.device,
                "error": self.error,
                "stems": list(STEMS) if self.status == "completed" else [],
            }

    def cancel(self):
        with self.lock:
            self.stop.set()
            if self.process is not None and self.process.poll() is None:
                self.process.kill()


class Jobs:
    def __init__(self, root):
        self.root = root
        self.items: dict[UUID, Job] = {}
        self.lock = Lock()
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="demucs")

    def reserve(self, device):
        with self.lock:
            if sum(job.snapshot()["status"] in {"uploading", "queued", "running"} for job in self.items.values()) >= 3:
                raise HTTPException(429, "เครื่องกำลังแยกเสียงหลายงาน รอให้งานเดิมเสร็จก่อน")
            key = uuid4()
            folder = self.root / str(key)
            folder.mkdir()
            job = Job(key, folder, device)
            self.items[key] = job
            return job

    def get(self, key):
        with self.lock:
            job = self.items.get(key)
        if job is None:
            raise HTTPException(404, "ไม่พบงานแยกเสียง หรือไฟล์หมดอายุแล้ว")
        return job

    def discard(self, job):
        with self.lock:
            self.items.pop(job.key, None)
        shutil.rmtree(job.folder, ignore_errors=True)

    def reap(self):
        with self.lock:
            expired = [job for job in self.items.values() if job.expires <= time.monotonic()]
        for job in expired:
            self.discard(job)


def song_seconds(path):
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-format_whitelist", AUDIO_FORMATS,
             "-select_streams", "a:0", "-show_entries", "stream=duration:format=duration", "-of", "json", str(path)],
            capture_output=True, text=True, check=True, timeout=25,
        )
        data = json.loads(result.stdout)
        stream = data["streams"][0]
        raw = stream.get("duration")
        if raw in (None, "N/A"):
            raw = data.get("format", {}).get("duration")
        seconds = float(raw)
        if not math.isfinite(seconds) or seconds <= 0:
            raise ValueError("unknown duration")
        return seconds
    except (IndexError, KeyError, TypeError, ValueError, OSError, subprocess.SubprocessError) as error:
        raise ValueError("อ่านไฟล์เสียงไม่ได้ ลองไฟล์ MP3, WAV, FLAC หรือ M4A ที่เล่นได้") from error


def normalize_audio(job):
    # Feed Demucs a plain local PCM file. Limit protocols and demuxers when
    # opening user files so playlists cannot cause secondary reads.
    if song_seconds(job.upload) > MAX_SECONDS:
        raise ValueError("รองรับไฟล์เสียงยาวไม่เกิน 10 นาทีต่อครั้ง")
    try:
        subprocess.run(
            ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
             "-protocol_whitelist", "file,pipe", "-format_whitelist", AUDIO_FORMATS,
             "-i", str(job.upload), "-map", "0:a:0", "-t", str(MAX_SECONDS), "-ac", "2", "-ar", "44100",
             "-c:a", "pcm_s16le", str(job.source)],
            capture_output=True, check=True, timeout=90,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise ValueError("ถอดรหัสไฟล์เสียงไม่ได้ ลองไฟล์ MP3, WAV, FLAC หรือ M4A ที่เล่นได้") from error
    job.upload.unlink()


def run_demucs(job, device):
    env = {**os.environ, "PYTHONUNBUFFERED": "1", "PYTORCH_ENABLE_MPS_FALLBACK": "1"}
    # Demucs 4 uses the legacy loader for its fixed upstream checkpoint. Do not
    # pass user-supplied checkpoints or allow this setting in the API process.
    env.pop("TORCH_FORCE_WEIGHTS_ONLY_LOAD", None)
    env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
    command = [
        sys.executable, "-m", "demucs", "-n", MODEL, "--device", device,
        "--out", str(job.folder), "--shifts", "0", "--clip-mode", "clamp", str(job.source),
    ]
    tail = deque(maxlen=12)
    separating = False
    with subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          encoding="utf-8", errors="replace", bufsize=1) as process:
        with job.lock:
            job.process = process
            if job.stop.is_set() and process.poll() is None:
                process.kill()
        try:
            for line in process.stdout:
                entry = line.strip()
                if entry:
                    tail.append(entry)
                if "Separating track" in line:
                    separating = True
                    job.update(stage="separating", progress=10)
                if separating:
                    percent = re.search(r"(\d{1,3})%\|", line)
                    if percent:
                        progress = 10 + min(100, int(percent[1])) * 85 // 100
                        job.update(progress=progress, stage="exporting" if progress == 95 else "separating")
            code = process.wait()
        finally:
            job.update(process=None)
    if job.stop.is_set():
        return False
    if code or not all(job.output(stem).is_file() for stem in STEMS):
        print(f"Demucs {device} (job {job.key}):\n" + "\n".join(tail), file=sys.stderr, flush=True)
        return False
    return True


def separate(job):
    status = "failed"
    error = None
    try:
        if job.stop.is_set():
            return
        job.update(status="running", stage="checking_audio", progress=4)
        normalize_audio(job)
        if job.stop.is_set():
            return
        first = job.device
        job.update(stage="loading_model", progress=6)
        success = run_demucs(job, first)
        if not success and first != "cpu" and not job.stop.is_set():
            shutil.rmtree(job.folder / MODEL, ignore_errors=True)
            job.update(device="cpu", stage="fallback_cpu", progress=6)
            success = run_demucs(job, "cpu")
        if success:
            status = "completed"
        elif not job.stop.is_set():
            error = "Demucs แยกไฟล์นี้ไม่สำเร็จ ดูรายละเอียดที่หน้าต่างเซิร์ฟเวอร์"
    except ValueError as cause:
        error = str(cause)
    except Exception as cause:
        print(f"Job {job.key}: {cause}", file=sys.stderr, flush=True)
        error = "แยกเสียงไม่สำเร็จ ตรวจสอบพื้นที่ว่างและหน้าต่างเซิร์ฟเวอร์"
    finally:
        if job.stop.is_set():
            status = "cancelled"
        job.upload.unlink(missing_ok=True)
        job.source.unlink(missing_ok=True)
        if status != "completed":
            shutil.rmtree(job.folder / MODEL, ignore_errors=True)
        job.update(status=status, stage=status, error=error, expires=time.monotonic() + RESULT_TTL,
                   progress=100 if status == "completed" else job.progress)


@asynccontextmanager
async def lifespan(application):
    with tempfile.TemporaryDirectory(prefix="music-training-stems-") as directory:
        jobs = Jobs(Path(directory))
        application.state.jobs = jobs
        hardware()

        async def cleanup():
            while True:
                await asyncio.sleep(60)
                await asyncio.to_thread(jobs.reap)

        cleanup_task = asyncio.create_task(cleanup())
        try:
            yield
        finally:
            cleanup_task.cancel()
            with jobs.lock:
                active_jobs = list(jobs.items.values())
            for job in active_jobs:
                job.cancel()
            jobs.pool.shutdown(wait=True)


app = FastAPI(title="Music Training Local Stem Engine", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


cors_options = {"allow_private_network": True} if "allow_private_network" in signature(CORSMiddleware).parameters else {}
app.add_middleware(
    CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-Stem-Key"], **cors_options,
)


@app.middleware("http")
async def private_network_preflight(request: Request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin")
    if (request.method == "OPTIONS" and response.status_code < 300 and origin in ORIGINS
            and request.headers.get("access-control-request-private-network") == "true"):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    if request.url.path == "/health" or request.url.path.startswith("/separate"):
        response.headers["Cache-Control"] = "no-store"
    return response


def authorize(x_stem_key: str | None = Header(default=None)):
    if not x_stem_key or not secrets.compare_digest(x_stem_key.encode(), ACCESS_KEY.encode()):
        raise HTTPException(401, "รหัสเชื่อมต่อไม่ถูกต้อง ดูรหัสที่หน้าต่างเซิร์ฟเวอร์")


@app.get("/health", dependencies=[Depends(authorize)])
def health():
    device, label = hardware()
    missing = missing_dependencies()
    return {"service": "music-training-stems", "model": MODEL, "ready": not missing, "device": device,
            "hardware": label, "missing": missing, "max_bytes": MAX_UPLOAD, "max_seconds": MAX_SECONDS}


@app.post("/separate", status_code=202, dependencies=[Depends(authorize)])
async def upload(request: Request):
    if missing_dependencies():
        raise HTTPException(503, "ยังติดตั้ง Demucs หรือ FFmpeg ไม่ครบ")
    try:
        size = int(request.headers.get("content-length", "0"))
    except ValueError as error:
        raise HTTPException(400, "ขนาดไฟล์ไม่ถูกต้อง") from error
    if size > MAX_UPLOAD:
        raise HTTPException(413, "รองรับไฟล์ไม่เกิน 150 MB")
    if request.headers.get("content-type", "").split(";")[0].lower() != "application/octet-stream":
        raise HTTPException(415, "ส่งข้อมูลไฟล์เป็น application/octet-stream")
    jobs = request.app.state.jobs
    job = jobs.reserve(hardware()[0])
    try:
        written = 0
        with job.upload.open("wb") as source:
            async for chunk in request.stream():
                written += len(chunk)
                if written > MAX_UPLOAD:
                    raise HTTPException(413, "รองรับไฟล์ไม่เกิน 150 MB")
                if chunk:
                    await asyncio.to_thread(source.write, chunk)
        if not written:
            raise HTTPException(400, "ไฟล์นี้ว่าง")
        job.update(status="queued", stage="queued")
        jobs.pool.submit(separate, job)
    except BaseException:
        jobs.discard(job)
        raise
    return job.snapshot()


@app.get("/separate/{job_id}", dependencies=[Depends(authorize)])
def query(job_id: UUID, request: Request):
    return request.app.state.jobs.get(job_id).snapshot()


@app.get("/separate/{job_id}/stems/{stem}", dependencies=[Depends(authorize)])
def download(job_id: UUID, stem: Stem, request: Request):
    job = request.app.state.jobs.get(job_id)
    if job.snapshot()["status"] != "completed":
        raise HTTPException(409, "ยังแยกเสียงไม่เสร็จ")
    return FileResponse(job.output(stem), media_type="audio/wav", filename=f"{stem}.wav")


@app.delete("/separate/{job_id}", status_code=204, dependencies=[Depends(authorize)])
def cancel(job_id: UUID, request: Request):
    jobs = request.app.state.jobs
    job = jobs.get(job_id)
    if job.snapshot()["status"] in {"completed", "failed", "cancelled"}:
        jobs.discard(job)
    else:
        job.cancel()
    return Response(status_code=204)


def web_directory():
    paths = [HERE.parent / "web" / "dist", HERE / "web-dist"]
    if os.getenv("STEM_WEB_DIST"):
        paths.insert(0, Path(os.environ["STEM_WEB_DIST"]).expanduser())
    return next((path for path in paths if (path / "index.html").is_file()), None)


WEB_DIST = web_directory()
if WEB_DIST:
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
else:
    @app.get("/", response_class=PlainTextResponse)
    def landing():
        return "Music Training Local Engine. Build web/dist or copy the production build to local-gpu-engine/web-dist."


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
            # Resolve the preferred LAN interface without sending a packet.
            connection.connect(("192.0.2.1", 80))
            return connection.getsockname()[0]
    except OSError:
        return "127.0.0.1"


if __name__ == "__main__":
    import uvicorn

    cert = os.getenv("STEM_TLS_CERTFILE")
    key = os.getenv("STEM_TLS_KEYFILE")
    if bool(cert) != bool(key):
        raise SystemExit("Set both STEM_TLS_CERTFILE and STEM_TLS_KEYFILE to enable HTTPS.")
    scheme = "https" if cert else "http"
    print(f"Local: {scheme}://localhost:{PORT}", flush=True)
    if HOST == "0.0.0.0":
        print(f"Wi-Fi / iPad URL: {scheme}://{lan_ip()}:{PORT}", flush=True)
    print(f"Connection code: {ACCESS_KEY}", flush=True)
    print(f"Web app: {WEB_DIST or 'build web/dist to serve the app on the same address'}", flush=True)
    uvicorn.run(app, host=HOST, port=PORT, ssl_certfile=cert, ssl_keyfile=key)
