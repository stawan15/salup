const instructions = `คุณเป็นผู้ช่วยส่วนตัวที่ช่วยเรียบเรียงบันทึกงานของคนจริง ๆ ไม่ใช่เครื่องสร้างรายงานสำเร็จรูป

เขียนภาษาไทยให้เป็นธรรมชาติ มีจังหวะและน้ำหนักของภาษาเหมือนคนที่เข้าใจเรื่องนั้นจริง ห้ามเปิดทุกคำตอบด้วยประโยคเดิม ห้ามแต่งข้อมูล ชื่อ จำนวน หรือสถานะที่ผู้ใช้ไม่ได้ให้มา

ถ้าเป็น report: ให้เรียบเรียงเป็นข้อความพร้อมส่งหัวหน้า แบ่งย่อหน้าอย่างมีเหตุผลและใช้หัวข้อ HTML เฉพาะเมื่อช่วยให้อ่านง่าย ไม่จำเป็นต้องใช้หัวข้อเดิมทุกครั้ง น้ำเสียงควรสุภาพกึ่งทางการ เป็นภาษางานที่อ่านแล้วเป็นมืออาชีพ แต่ไม่แข็งเป็นเอกสารราชการ
ถ้าเป็น speech: ให้เขียนเป็นบทพูดที่อ่านออกเสียงได้จริง มีน้ำเสียงต่อเนื่อง เล่าเรื่องลื่นไหล
ถ้าเป็น chat (ภาษาพูด):
- ต้องเขียนเป็นภาษาพูดจริง ๆ 100% เหมือนคนกำลังเล่าอัปเดตงานให้พี่หรือเพื่อนร่วมงานฟังในแชต
- ห้ามใช้คำทางการ คำเชื่อมหนังสือ หรือคำประดิษฐ์เด็ดขาด เช่น "ลุยงาน", "นอกจากนี้", "ปรับแก้ไข", "ดำเนินการ", "ทั้งนี้", "อย่างไรก็ดี", "ประเด็นสำคัญ", "ในการนี้", "ทำการ"
- ให้ใช้คำพูดง่าย ๆ เหมือนคนเล่าปากเปล่า เช่น "หนูทำ...นี้แล้ว", "แก้ตรง...เรียบร้อยแล้ว", "แล้วก็ต่อด้วยตรงนี้", "ไปดูเรื่อง...", "คุยกับ...", "เดี๋ยวต่อไปจะไปทำ...ต่อ"
- เล่าเรียงลำดับสิ่งที่ทำ สิ่งที่ติดขัด (ถ้ามี) และสิ่งที่จะทำต่อให้ฟังง่าย สบายหู สุภาพ แต่เป็นกันเอง ไม่แข็งเป็นรายงาน
ถ้าเป็น bullet: ให้ใช้ข้อสั้น ๆ แต่แต่ละข้อควรมีสาระและใช้คำขึ้นต้นหลากหลาย ไม่ใช่คัดประโยคเดิมมาเรียง

ก่อนส่งคำตอบ ให้ทำหน้าที่เป็นบรรณาธิการอีกครั้ง:
- ถ้าเป็น chat ต้องตัดคำพวก "ลุยงาน", "นอกจากนี้", "ปรับแก้ไข", "ดำเนินการ", "ในส่วนของ", "ทั้งนี้", "ประเด็นติดตาม" ออกให้หมด เปลี่ยนเป็นคำกริยาพูดปากเปล่า เช่น ทำ, แก้, ต่อด้วย, ไปดู, ส่ง, คุย
- ห้ามบอกว่ากำลังสรุป ห้ามพูดถึง AI ห้ามใส่คำชมลอย ๆ และห้ามเติมประโยคปิดแบบทางการถ้าไม่มีข้อมูลรองรับ ให้คำตอบเหมือนเจ้าของงานเขียนเองหลังจากมีคนช่วยเกลาภาษาให้

ผลลัพธ์ต้องเป็น HTML ที่ปลอดภัย ใช้ได้เฉพาะ <p>, <br>, <h3>, <ul>, <li> และห้ามใส่ markdown หรือ code fence`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  try {
    const { mode = 'daily', work = '', blocker = '', next = '', voice = 'neutral', format = 'report', category = 'ทั่วไป', entries = [], styleExamples = [] } = req.body || {};
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const voiceGuide = {
      neutral: 'ใช้สรรพนามกลาง สุภาพ เป็นธรรมชาติ ไม่ต้องเน้นเพศ เช่น "วันนี้ทำ...เสร็จแล้ว แล้วก็ต่อด้วย..."',
      female: 'เขียนด้วยน้ำเสียงผู้หญิง ใช้สรรพนาม “หนู” พูดคุยอย่างเป็นธรรมชาติ ลงท้าย “ค่ะ / นะคะ” เหมือนหนูเล่าอัปเดตงานให้พี่ในทีมฟัง เช่น "วันนี้หนูทำตรงนี้เสร็จแล้วค่ะ แล้วก็ต่อไปดูตรงนี้ต่อ..."',
      male: 'เขียนด้วยน้ำเสียงผู้ชาย ใช้สรรพนาม “ผม” ลงท้าย “ครับ” อย่างสุภาพและเป็นธรรมชาติ เช่น "วันนี้ผมทำตรงนี้เสร็จแล้วครับ แล้วก็ต่อด้วย..."'
    }[voice] || 'ใช้สรรพนามกลาง สุภาพ เป็นธรรมชาติ';
    const formatGuide = {
      report: 'จัดเป็นบทรายงานสำหรับส่งหัวหน้า มีหัวข้อชัดเจนและภาษาสุภาพกึ่งทางการ เป็นมืออาชีพ',
      speech: 'จัดเป็นบทพูดที่อ่านออกเสียงได้ลื่นไหล สุภาพ เล่าเรื่องต่อเนื่องเป็นธรรมชาติ',
      chat: 'เขียนเป็นภาษาพูดปากเปล่าเล่าให้พี่หรือเพื่อนร่วมงานฟังเด็ดขาด ห้ามใช้คำทางการอย่าง "ลุยงาน", "นอกจากนี้", "ปรับแก้ไข", "ดำเนินการ" ให้ใช้คำพูดง่าย ๆ เหมือนคนคุยกัน เช่น "หนู/ผมทำตรงนี้เสร็จแล้ว แล้วก็ต่อไปทำตรงนี้ เดี๋ยวจะไปดูตรงนี้ต่อ"',
      bullet: 'สรุปเป็นข้อสั้น ๆ ชัดเจน เหมาะสำหรับอ่านเร็ว ใช้ภาษางานที่สุภาพ'
    }[format] || 'จัดเป็นบทรายงานสำหรับส่งหัวหน้า';
    const weeklyGuide = mode === 'weekly'
      ? 'นี่คือข้อมูลสะสมรายสัปดาห์ ให้เรียบเรียงเป็นภาพรวมของงานที่ทำ แยกสิ่งที่เดินหน้า ปัญหาที่พบ และสิ่งที่ควรทำต่อเมื่อมีข้อมูล ห้ามเขียนแยกรายวันแบบซ้ำ ๆ และห้ามนับจำนวนขึ้นมาเอง'
      : '';
    const feedbackGuide = styleExamples.length
      ? `ผู้ใช้เคยให้คะแนนตัวอย่างสำนวนต่อไปนี้ คะแนนสูงควรใช้เป็นสัญญาณเรื่องจังหวะภาษาและระดับความเป็นทางการเท่านั้น เหตุผลที่ผู้ใช้เลือกไว้ใช้เป็นแนวทางได้ ห้ามคัดลอกเนื้อหา ชื่อ หรือข้อเท็จจริงจากตัวอย่าง และอย่าพูดถึงคะแนนในการตอบ:\n${styleExamples.map((example) => `[${example.rating}/5 · ${example.format}${example.feedback ? ` · ${example.feedback}` : ''}] ${example.text}`).join('\n')}`
      : 'ยังไม่มีตัวอย่างจากการรีวิว ให้ยึดสไตล์ที่ผู้ใช้เลือกและข้อมูลปัจจุบันเป็นหลัก';
    const styleInstructions = `${voiceGuide}\n${formatGuide}\n${weeklyGuide}\n${feedbackGuide}\nห้ามเปลี่ยนข้อเท็จจริงหรือเติมข้อมูลที่ผู้ใช้ไม่ได้ให้มา`;
    if (mode === 'coop') {
      const inputText = entries.map((entry) => `วันที่ ${entry.date} · หมวด ${entry.category || 'ทั่วไป'}\nงาน: ${entry.work || 'ไม่ได้ระบุ'}\nสิ่งที่ติดขัด: ${entry.blocker || 'ไม่มี'}\nแผนงานถัดไป: ${entry.next || 'ไม่ได้ระบุ'}`).join('\n\n');
      const coopInstructions = `คุณเป็นผู้ช่วยสร้างรายงานสหกิจ วิเคราะห์บันทึกงานรายวัน แล้วแยกข้อมูลออกเป็น 5 ส่วนตามรูปแบบ JSON ต่อไปนี้ ห้ามมี markdown (เช่น \`\`\`json) ให้ตอบมาเป็นแค่ JSON object ล้วนๆ:
{
  "summary": {
    "assignment": "สรุปงานที่ได้รับมอบหมาย",
    "performance": "ผลการปฏิบัติงานที่ทำสำเร็จ",
    "problems": "ปัญหาและอุปสรรคที่พบ (ถ้าไม่มีให้เขียนว่า ไม่มี)",
    "solutions": "วิธีการแก้ไขปัญหา (ถ้าไม่มีให้เขียนว่า ไม่มี)",
    "daily": [
      { "date": "วัน-เดือน-ปี", "activities": "รายละเอียดการปฏิบัติงานรายวัน" }
    ]
  }
}
ใช้ภาษาไทยทางการที่เหมาะสมกับเอกสารมหาวิทยาลัย`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: coopInstructions }] },
          contents: [{ role: 'user', parts: [{ text: inputText }] }],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Gemini API request failed');
      const rawText = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
      const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
      return res.status(200).json(JSON.parse(cleanJson));
    }

    const inputText = mode === 'weekly'
      ? entries.map((entry) => `วันที่ ${entry.date} · หมวด ${entry.category || 'ทั่วไป'}\nงาน: ${entry.work || 'ไม่ได้ระบุ'}\nสิ่งที่ติดขัด: ${entry.blocker || 'ไม่มี'}\nแผนงานถัดไป: ${entry.next || 'ไม่ได้ระบุ'}`).join('\n\n')
      : `หมวดงาน: ${category}\n\nงานที่ทำวันนี้:\n${work}\n\nสิ่งที่ติดขัด:\n${blocker || 'ไม่มี'}\n\nแผนงานถัดไป:\n${next || 'ไม่ได้ระบุ'}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${instructions}\n\nสไตล์ที่ผู้ใช้เลือก:\n${styleInstructions}` }] },
        contents: [{ role: 'user', parts: [{ text: inputText }] }],
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
