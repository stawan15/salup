const instructions = `คุณเป็นผู้ช่วยสรุปงานสำหรับพนักงานออฟฟิศไทย สรุปเป็นภาษาไทยที่เป็นธรรมชาติ กระชับ อ่านแล้วเข้าใจทันที ใช้หัวข้อ HTML เท่านั้น: <h3>ภาพรวมการทำงาน</h3>, <h3>ประเด็นติดตาม</h3> และถ้ามีให้เพิ่ม <h3>แผนงานถัดไป</h3> ห้ามแต่งข้อมูลเพิ่ม ห้ามใช้ภาษาทางการเกินจำเป็น และคงรายละเอียดสำคัญ เช่น จำนวนงาน ชื่อทีม หรือสถานะไว้`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  try {
    const { work = '', blocker = '', next = '' } = req.body || {};
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text: `งานที่ทำวันนี้:\n${work}\n\nสิ่งที่ติดขัด:\n${blocker || 'ไม่มี'}\n\nแผนงานถัดไป:\n${next || 'ไม่ได้ระบุ'}` }] }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API request failed');
    const summary = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    if (!summary) throw new Error('Gemini ไม่ส่งผลลัพธ์กลับมา');
    return res.status(200).json({ summary });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Gemini request failed' });
  }
}
