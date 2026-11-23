"""Prepare the local virtual environment and launch the engine."""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv

HERE = Path(__file__).resolve().parent


def run(command, cwd=HERE, *, check=True):
    return subprocess.run(command, cwd=cwd, check=check)


def has_nvidia():
    tool = shutil.which("nvidia-smi")
    if not tool:
        return False
    try:
        return run([tool, "-L"], check=False).returncode == 0
    except OSError:
        return False


def main():
    if sys.version_info[:2] not in {(3, 10), (3, 11), (3, 12)}:
        raise SystemExit("Install Python 3.10, 3.11 or 3.12, then run the launcher again.")

    environment = HERE / ".venv"
    python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        venv.EnvBuilder(with_pip=True).create(environment)

    pip = [str(python), "-m", "pip", "install", "--disable-pip-version-check"]
    if sys.platform != "darwin":
        # Leave an explicitly installed PyTorch wheel intact on subsequent runs.
        installed = run([str(python), "-c", "import importlib.util as u; raise SystemExit(not (u.find_spec('torch') and u.find_spec('torchaudio')))"],
                        check=False).returncode == 0
        if not installed:
            wheel = "cu124" if has_nvidia() else "cpu"
            wheels = ["torch==2.6.0", "torchaudio==2.6.0"]
            attempt = run([*pip, "--index-url", f"https://download.pytorch.org/whl/{wheel}", *wheels], check=False)
            if attempt.returncode:
                run([*pip, "--index-url", "https://download.pytorch.org/whl/cpu", *wheels])
    run([*pip, "-r", "requirements.txt"])

    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        print("Install FFmpeg (including ffprobe) and add it to PATH to enable separation. See README.md.", flush=True)

    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    web = HERE.parent / "web"
    if npm and (web / "package-lock.json").is_file() and not ((web / "dist/index.html").is_file()
            or (HERE / "web-dist/index.html").is_file() or os.getenv("STEM_WEB_DIST")):
        npm_command = [os.environ.get("ComSpec", "cmd.exe"), "/d", "/c", npm] if os.name == "nt" else [npm]
        try:
            if run([*npm_command, "ci"], cwd=web, check=False).returncode == 0:
                run([*npm_command, "run", "build"], cwd=web, check=False)
        except OSError as error:
            print(f"Could not build the optional LAN web app: {error}", flush=True)
    return run([str(python), str(HERE / "server.py")], check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
