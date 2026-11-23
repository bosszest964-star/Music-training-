# Local GPU Engine · ห้องซ้อม

แยกเพลงด้วย Demucs รุ่น `htdemucs` เป็น WAV สเตอริโอ 4 แทร็ก ได้แก่ Vocals, Drums, Bass และ Other ไฟล์ถูกส่งตรงจากเบราว์เซอร์ไปยังคอมพิวเตอร์ที่ระบุและประมวลผลบนเครื่องนั้น ครั้งแรกต้องใช้อินเทอร์เน็ตดาวน์โหลดแพ็กเกจและน้ำหนักโมเดลจากแหล่งเผยแพร่ของ [Demucs](https://github.com/facebookresearch/demucs)

## เตรียมเครื่อง

| สิ่งที่ต้องมี | รายละเอียด |
|---|---|
| Python | 3.10, 3.11 หรือ 3.12 บนระบบ 64 บิต ใช้ Python แบบ arm64 บน Mac Apple Silicon |
| FFmpeg | ต้องเรียกทั้ง `ffmpeg -version` และ `ffprobe -version` ได้ใน Terminal หรือ Command Prompt |
| Node.js และ npm | ใช้ Node.js 22.12+ หรือ 20.19+ ในสาย 20 หากต้องการให้สคริปต์ build เว็บเพื่อเปิดผ่าน LAN |
| GPU | NVIDIA ใช้ CUDA หาก PyTorch และไดรเวอร์รองรับ Apple Silicon ใช้ MPS หากพร้อม ระบบใช้ CPU เมื่อไม่มีตัวเร่งหรือเมื่อรันงานบนตัวเร่งไม่สำเร็จ |

ติดตั้ง FFmpeg ด้วย `winget install Gyan.FFmpeg` บน Windows, `brew install ffmpeg` บน macOS หรือ `sudo apt install ffmpeg python3-venv` บน Debian/Ubuntu ตามเครื่องที่ใช้ ถ้าเพิ่งเพิ่มลง PATH ให้เปิด Terminal ใหม่

## เปิดเซิร์ฟเวอร์

1. ดาวน์โหลด ZIP ทั้งโปรเจกต์จากเมนู **Code → Download ZIP** บน GitHub แล้วแตกไฟล์ หากต้องการใช้ API อย่างเดียว สามารถคัดลอกเฉพาะโฟลเดอร์ `local-gpu-engine/` ได้
2. เปิด `start_windows.bat` บน Windows หรือเปิด Terminal เข้าโฟลเดอร์ `local-gpu-engine/` แล้วรัน `./start_mac_linux.sh` บน macOS/Linux หากไฟล์ไม่มีสิทธิ์รัน ใช้ `sh start_mac_linux.sh`
3. สคริปต์สร้าง `.venv` และติดตั้งแพ็กเกจ Windows/Linux เลือก PyTorch CUDA เมื่อตรวจพบ NVIDIA และใช้ชุด CPU เมื่อไม่พบหรือเมื่อติดตั้งชุด CUDA ไม่สำเร็จ ถ้าแตกไฟล์ทั้งโปรเจกต์และมี npm สคริปต์จะ build เว็บให้เมื่อยังไม่มีไฟล์ build
4. เปิดหน้าต่างนั้นค้างไว้ จดค่า **Wi-Fi / iPad URL** เช่น `http://192.168.1.25:8765` และ **Connection code** รหัสเริ่มต้นเปลี่ยนทุกครั้งที่เปิดเซิร์ฟเวอร์ใหม่ ตั้ง `STEM_ACCESS_KEY` เองได้ผ่านตัวแปรสภาพแวดล้อม
5. ถ้าเลข IP ในหน้าต่างเป็นของ VPN หรือไม่ตรงกับ Wi-Fi ให้ดู IPv4 ของอะแดปเตอร์ Wi-Fi ด้วย `ipconfig` บน Windows, **System Settings → Wi-Fi → Details → TCP/IP** บน macOS หรือ `hostname -I` บน Linux แล้วใช้พอร์ตเดิม

## เชื่อมจาก iPad ใน Wi‑Fi เดียวกัน

1. เชื่อม iPad และคอมเข้าวง Wi-Fi เดียวกัน หาก Windows Firewall ถาม ให้เปิดรับการเชื่อมต่อสำหรับเครือข่ายส่วนตัวที่ใช้อยู่
2. เปิด **Wi-Fi / iPad URL** ใน Safari เพื่อใช้หน้าเว็บและ API จากที่อยู่เดียวกัน ถ้าเห็นข้อความ Engine อย่างเดียว ให้ build เว็บด้วย `npm ci` แล้ว `npm run build` ใน `web/` และเปิด Engine ใหม่ หากติดตั้งเฉพาะ Engine ให้คัดลอกเนื้อหาจาก `web/dist/` มาไว้ใน `local-gpu-engine/web-dist/`
3. เปิด **แยกไลน์ดนตรี → แยกด้วย AI บนคอม** กรอก URL และรหัสตามหน้าต่างบนคอม แล้วกด **ตรวจการเชื่อมต่อ** หน้าจอจะแสดงชื่อฮาร์ดแวร์และ CUDA, MPS หรือ CPU
4. เลือกเพลงและรอให้แยกเสร็จ มิกเซอร์จะดึง WAV ทั้งสี่แทร็กมาเปิดโดยอัตโนมัติ

Safari ใช้ AudioContext เล่นมิกเซอร์ในหน้า LAN แบบ HTTP ได้ ฟีเจอร์ไมโครโฟน, Web MIDI และการติดตั้ง PWA ใช้หน้าเว็บผ่าน HTTPS หรือ localhost ตามข้อกำหนดของเบราว์เซอร์

## เชื่อมจากเว็บบน Vercel หรือ HTTPS อื่น

หน้า HTTPS อาจบล็อกการเรียก HTTP ใน LAN โดยเฉพาะ Safari ให้ใช้หน้า LAN จากหัวข้อก่อน หรือเปิด Engine ด้วยใบรับรอง HTTPS ที่อุปกรณ์เชื่อถือและตรงกับชื่อโฮสต์หรือ IP ที่จะกรอก ตั้งค่าต่อไปนี้ก่อนเปิดสคริปต์ ในตัวอย่างสมมติว่ามีไฟล์ใบรับรองและกุญแจสำหรับ IP แล้ว

```sh
export STEM_ALLOWED_ORIGINS="https://your-project.vercel.app"
export STEM_TLS_CERTFILE="/path/to/lan-cert.pem"
export STEM_TLS_KEYFILE="/path/to/lan-key.pem"
./start_mac_linux.sh
```

```powershell
$env:STEM_ALLOWED_ORIGINS = "https://your-project.vercel.app"
$env:STEM_TLS_CERTFILE = "C:\certs\lan-cert.pem"
$env:STEM_TLS_KEYFILE = "C:\certs\lan-key.pem"
.\start_windows.bat
```

สำหรับ LAN สามารถออกใบรับรองด้วย [mkcert](https://github.com/FiloSottile/mkcert) โดยระบุ IP ของคอม เช่น `mkcert 192.168.1.25` แล้วใช้ไฟล์ที่ได้กับตัวแปรข้างบน บน iPad ให้ติดตั้ง **ใบรับรอง CA สาธารณะ** จากตำแหน่งที่ `mkcert -CAROOT` แสดง และเปิดการเชื่อถือใน **การตั้งค่า → ทั่วไป → เกี่ยวกับ → การตั้งค่าการเชื่อถือใบรับรอง** เก็บกุญแจส่วนตัวของ CA และกุญแจของเซิร์ฟเวอร์ไว้บนคอม

ใส่หลาย origin ใน `STEM_ALLOWED_ORIGINS` ได้โดยคั่นด้วยจุลภาค เช่น origin ของ Vercel และของเว็บสำหรับพัฒนาในเครือข่าย ระบบอนุญาตแบบระบุ origin ตรงกัน และตอบ preflight สำหรับการเข้าถึงเครือข่ายส่วนตัวเมื่อเบราว์เซอร์ส่งมา หากเบราว์เซอร์ขอสิทธิ์เข้าถึงเครือข่ายท้องถิ่น ให้กดอนุญาต เว็บต้องเชื่อมถึงเครื่อง Engine ภายใน Wi-Fi จึงไม่ต้องเปิดพอร์ตจากอินเทอร์เน็ต

## API และพื้นที่ไฟล์

ส่งรหัสด้วยเฮดเดอร์ `X-Stem-Key` ทุกคำขอ API เครื่องรับเพลงเสียงไม่เกิน 150 MiB หรือ 10 นาทีต่อครั้ง และประมวลผลหนึ่งงานพร้อมกัน

| Endpoint | การทำงาน |
|---|---|
| `GET /health` | ความพร้อม ชื่อฮาร์ดแวร์ ตัวเร่ง ขนาดสูงสุด และโมเดล |
| `POST /separate` | ส่งไบต์ไฟล์เสียงโดยใช้ `Content-Type: application/octet-stream` ได้รหัสงานและสถานะ HTTP 202 |
| `GET /separate/{id}` | สถานะ ขั้นตอน เปอร์เซ็นต์ และแทร็กที่พร้อม |
| `GET /separate/{id}/stems/{stem}` | ดึง WAV โดยใช้ `vocals`, `drums`, `bass` หรือ `other` |
| `DELETE /separate/{id}` | ยกเลิกงานหรือลบผลลัพธ์ |

Engine เก็บงานในพื้นที่ชั่วคราว ลบต้นฉบับเมื่อประมวลผลจบ ผู้ใช้เว็บจะลบผลลัพธ์จาก Engine เมื่อรับครบแล้ว ส่วนไฟล์ที่ยังคงค้างหมดอายุภายในประมาณหนึ่งชั่วโมงหรือเมื่อปิดโปรแกรม

ค่าเริ่มต้นรับที่พอร์ต `8765` ผ่าน LAN ตั้ง `STEM_HOST=127.0.0.1` หากใช้จากคอมเครื่องเดียว เปลี่ยนพอร์ตด้วย `STEM_PORT` และกำหนดโฟลเดอร์ build ด้วย `STEM_WEB_DIST` ได้ หากเปลี่ยนไดรเวอร์หรือประเภท GPU หลังติดตั้งและต้องการเปลี่ยนชุด PyTorch ให้ปิด Engine ก่อน แล้วติดตั้ง torch และ torchaudio ให้เป็นชุดเดียวกันใน `.venv` หรือลบเฉพาะ `.venv` ให้สคริปต์สร้างใหม่
