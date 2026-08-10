import OpenAI from 'openai';

const instructions = `คุณเป็นผู้ช่วยสรุปงานสำหรับพนักงานออฟฟิศไทย สรุปเป็นภาษาไทยที่เป็นธรรมชาติ กระชับ อ่านแล้วเข้าใจทันที ใช้หัวข้อ HTML เท่านั้น: <h3>ภาพรวมการทำงาน</h3>, <h3>ประเด็นติดตาม</h3> และถ้ามีให้เพิ่ม <h3>แผนงานถัดไป</h3> ห้ามแต่งข้อมูลเพิ่ม ห้ามใช้ภาษาทางการเกินจำเป็น และคงรายละเอียดสำคัญ เช่น จำนวนงาน ชื่อทีม หรือสถานะไว้`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const { work = '', blocker = '', next = '' } = req.body || {};
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      instructions,
      input: `งานที่ทำวันนี้:\n${work}\n\nสิ่งที่ติดขัด:\n${blocker || 'ไม่มี'}\n\nแผนงานถัดไป:\n${next || 'ไม่ได้ระบุ'}`,
      text: { verbosity: 'low' },
    });
    return res.status(200).json({ summary: response.output_text });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI request failed' });
  }
}
