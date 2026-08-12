# น้องโน้ต — Work Log AI

เว็บต้นแบบสำหรับกรอกงานรายวันและให้ AI เรียบเรียงเป็นสรุปภาษาไทย

## ลองใช้ทันที

ติดตั้ง dependencies ก่อน แล้วใช้ Vite สำหรับโหมดพัฒนา:

```bash
npm install
npm run dev
```

จากนั้นเปิด http://localhost:5173 โหมดนี้จะเปิดทั้ง Vite และ local API server ให้พร้อมกัน โดย Vite จะ proxy `/api` ไปที่ API server อัตโนมัติ

ถ้าต้องการรัน local server แบบเดิม ให้ใช้ `npm start` แล้วเปิด http://localhost:4173

สำหรับตรวจ production bundle ใช้:

```bash
npm test
npm run build
```

## เปิดใช้ AI จริง

```bash
npm install
GEMINI_API_KEY="ใส่คีย์ของคุณ" npm start
```

จากนั้นเปิด http://localhost:4173

ไฟล์ `scripts/local-server.mjs` ใช้สำหรับรันบนเครื่องเท่านั้น ส่วน Vercel จะใช้ `api/summarize.js` เป็น Serverless Function โดยอัตโนมัติ

ใช้ `GEMINI_MODEL` เพื่อเปลี่ยนโมเดลได้ เช่น `gemini-3.5-flash-lite` (ค่าเริ่มต้น) หรือโมเดลที่บัญชีของคุณเปิดใช้

## Deploy บน Vercel

1. Import repository `stawan15/salup` ใน Vercel
2. ตั้งค่า Environment Variable ชื่อ `GEMINI_API_KEY` ใน Project Settings
3. กด Deploy ได้เลย เพราะ `api/summarize.js` เป็น Vercel Function อยู่แล้ว

เปิด `Authentication → Providers → Email` ใน Supabase สำหรับการสมัครสมาชิกด้วยอีเมล และตั้งค่า Site URL/Redirect URLs เป็น `https://ai-summary.teveus.xyz` (รวม `https://salup.vercel.app` สำหรับทดสอบ)

ถ้าจะใช้โดเมน `app.teveus.xyz` ให้เพิ่มโดเมนนี้ใน Vercel ที่ `Settings > Domains` แล้วสร้าง DNS record ใน Namecheap เป็น `CNAME`, Host `app`, Value ตามที่ Vercel แสดง (โดยทั่วไปคือ `cname.vercel-dns.com`)

## CI/CD ด้วย GitHub Actions

ไฟล์ `.github/workflows/vercel-production.yml` จะตรวจ syntax และ deploy production ทุกครั้งที่ push เข้า `main` ตามขั้นตอน `vercel pull → vercel build → vercel deploy --prebuilt` ของ Vercel

เพิ่ม GitHub Repository Secrets 3 ตัว:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

หา `ORG_ID` และ `PROJECT_ID` ได้จาก `vercel link` แล้วดูไฟล์ `.vercel/project.json` (ห้าม commit ไฟล์นี้) ส่วน Token สร้างจาก Vercel Account Settings → Tokens

## ต่อ Supabase ภายหลัง

ตอนนี้เก็บข้อมูลในเครื่องเพื่อให้ทดลองได้ทันที จุดต่อไปคือย้าย `getEntries/saveEntries` ใน `app.js` ไปเรียก Supabase และเพิ่ม auth เพื่อให้ข้อมูลแยกตามผู้ใช้ โดยตารางที่เหมาะสมคือ `work_logs(id, user_id, work_date, work_text, blocker_text, next_text, ai_summary, created_at)`
