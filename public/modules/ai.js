import { AI_USAGE_KEY, readStorage } from './core.js';

const localDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function createAiClient({ getStyleExamples, onUsageChange = () => {} }) {
  const getAiUsage = () => {
    const todayKey = localDateString(new Date());
    const usage = readStorage(AI_USAGE_KEY);
    return usage.date === todayKey ? usage : { date: todayKey, count: 0 };
  };

  const recordAiUse = () => {
    const usage = getAiUsage();
    usage.count += 1;
    localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage));
    onUsageChange();
  };

  const assertAiAvailable = () => {
    if (getAiUsage().count >= 30) throw new Error('วันนี้ใช้ AI ครบ 30 ครั้งแล้ว ลองใหม่พรุ่งนี้');
  };

  const request = async (body) => {
    assertAiAvailable();
    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, styleExamples: getStyleExamples() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Gemini API ยังไม่พร้อมใช้งาน');
    if (!data.summary) throw new Error('Gemini ไม่ส่งผลลัพธ์กลับมา');
    recordAiUse();
    return data.summary;
  };

  return {
    getAiUsage,
    requestSummary: (work, blocker, next, voice, format, category) => request({ work, blocker, next, voice, format, category }),
    requestWeeklySummary: (entries, voice) => request({ mode: 'weekly', voice, format: 'report', category: 'สรุปประจำสัปดาห์', entries }),
  };
}
