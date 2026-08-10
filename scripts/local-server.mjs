import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const port = process.env.PORT || 4173;
const root = path.join(process.cwd(), 'public');
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const prompt = `คุณเป็นผู้ช่วยสรุปงานสำหรับพนักงานออฟฟิศไทย สรุปเป็นภาษาไทยที่เป็นธรรมชาติ กระชับ อ่านแล้วเข้าใจทันที ใช้หัวข้อ HTML เท่านั้น: <h3>ภาพรวมการทำงาน</h3>, <h3>ประเด็นติดตาม</h3> และถ้ามีให้เพิ่ม <h3>แผนงานถัดไป</h3> ห้ามแต่งข้อมูลเพิ่ม ห้ามใช้ภาษาทางการเกินจำเป็น และคงรายละเอียดสำคัญ เช่น จำนวนงาน ชื่อทีม หรือสถานะไว้`;
const send = (res, code, body, type='application/json') => { res.writeHead(code, {'Content-Type':type, 'Access-Control-Allow-Origin':'*'}); res.end(body); };
const server = http.createServer(async (req,res) => {
  if (req.method === 'POST' && req.url === '/api/summarize') {
    if (!client) return send(res, 503, JSON.stringify({error:'OPENAI_API_KEY is not configured'}));
    let raw=''; for await (const chunk of req) raw += chunk;
    try { const {work='', blocker='', next=''}=JSON.parse(raw); const response=await client.responses.create({model:process.env.OPENAI_MODEL || 'gpt-4o-mini', instructions:prompt, input:`งานที่ทำวันนี้:\n${work}\n\nสิ่งที่ติดขัด:\n${blocker || 'ไม่มี'}\n\nแผนงานถัดไป:\n${next || 'ไม่ได้ระบุ'}`, text:{verbosity:'low'}}); send(res,200,JSON.stringify({summary:response.output_text})); } catch (error) { send(res,500,JSON.stringify({error:error.message})); } return;
  }
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url.replace(/^\//,''));
  if (!file.startsWith(root) || !fs.existsSync(file)) return send(res,404,'Not found','text/plain');
  send(res,200,fs.readFileSync(file),mime[path.extname(file)] || 'application/octet-stream');
});
server.listen(port, () => console.log(`Worklog AI running at http://localhost:${port}`));
