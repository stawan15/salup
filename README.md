# น้องโน้ต — Work Log AI

เว็บต้นแบบสำหรับกรอกงานรายวันและให้ AI เรียบเรียงเป็นสรุปภาษาไทย

## ลองใช้ทันที

เปิด `index.html` ใน browser ได้เลย เว็บจะบันทึกประวัติใน `localStorage` และใช้โหมดสาธิตเมื่อยังไม่ได้ตั้งค่า API

## เปิดใช้ AI จริง

```bash
npm install
OPENAI_API_KEY="ใส่คีย์ของคุณ" npm start
```

จากนั้นเปิด http://localhost:4173

ไฟล์ `local-server.mjs` ใช้สำหรับรันบนเครื่องเท่านั้น ส่วน Vercel จะใช้ `api/summarize.js` เป็น Serverless Function โดยอัตโนมัติ

ใช้ `OPENAI_MODEL` เพื่อเปลี่ยนโมเดลได้ เช่น `gpt-5.6-luna` (ค่าเริ่มต้น) หรือโมเดลที่บัญชีของคุณเปิดใช้

## Deploy บน Vercel

1. Import repository `stawan15/salup` ใน Vercel
2. ตั้งค่า Environment Variable ชื่อ `OPENAI_API_KEY` ใน Project Settings
3. กด Deploy ได้เลย เพราะ `api/summarize.js` เป็น Vercel Function อยู่แล้ว

ถ้าจะใช้โดเมน `app.teveus.xyz` ให้เพิ่มโดเมนนี้ใน Vercel ที่ `Settings > Domains` แล้วสร้าง DNS record ใน Namecheap เป็น `CNAME`, Host `app`, Value ตามที่ Vercel แสดง (โดยทั่วไปคือ `cname.vercel-dns.com`)

## ต่อ Supabase ภายหลัง

ตอนนี้เก็บข้อมูลในเครื่องเพื่อให้ทดลองได้ทันที จุดต่อไปคือย้าย `getEntries/saveEntries` ใน `app.js` ไปเรียก Supabase และเพิ่ม auth เพื่อให้ข้อมูลแยกตามผู้ใช้ โดยตารางที่เหมาะสมคือ `work_logs(id, user_id, work_date, work_text, blocker_text, next_text, ai_summary, created_at)`
