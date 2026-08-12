import { escapeHtml } from './core.js';

export const historyLabels = { report: 'บทรายงาน', speech: 'บทพูด', chat: 'ภาษาพูด', bullet: 'สรุปเป็นข้อ' };

export function filterHistoryEntries(entries, { format = 'all', category = 'all', search = '' } = {}) {
  return entries.filter((entry) => (
    (format === 'all' || entry.format === format)
    && (category === 'all' || entry.category === category)
    && (!search || `${entry.title} ${entry.plainSummary} ${entry.category || ''}`.toLowerCase().includes(search))
  ));
}

export function renderHistoryMarkup(entries, ratingStars) {
  if (!entries.length) return '<div class="history-empty">ยังไม่มีประวัติที่ตรงกับตัวกรองนี้</div>';
  return entries.map((entry) => `<article class="history-item" data-entry-key="${escapeHtml(entry.createdAt)}"><div class="history-item-top"><time>${escapeHtml(entry.title)}</time><div class="history-item-actions"><div class="history-tags"><span>${escapeHtml(historyLabels[entry.format] || 'บทรายงาน')}</span><span>${escapeHtml(entry.category || 'ทั่วไป')}</span></div><button class="history-copy" type="button">คัดลอก</button><button class="history-edit" type="button">แก้ไข</button><button class="history-delete" type="button">ลบ</button></div></div><p class="history-preview">${escapeHtml(entry.plainSummary)}</p><div class="history-rating"><span>รีวิวสำนวน</span><div class="rating-stars">${ratingStars(entry.rating)}</div><select class="feedback-select" aria-label="เหตุผลของคะแนน"><option value="">เหตุผล</option><option value="เป็นธรรมชาติ" ${entry.feedback === 'เป็นธรรมชาติ' ? 'selected' : ''}>เป็นธรรมชาติ</option><option value="กระชับดี" ${entry.feedback === 'กระชับดี' ? 'selected' : ''}>กระชับดี</option><option value="เหมาะกับงาน" ${entry.feedback === 'เหมาะกับงาน' ? 'selected' : ''}>เหมาะกับงาน</option><option value="ทางการเกินไป" ${entry.feedback === 'ทางการเกินไป' ? 'selected' : ''}>ทางการเกินไป</option><option value="ยาวเกินไป" ${entry.feedback === 'ยาวเกินไป' ? 'selected' : ''}>ยาวเกินไป</option><option value="ใช้คำซ้ำ" ${entry.feedback === 'ใช้คำซ้ำ' ? 'selected' : ''}>ใช้คำซ้ำ</option></select></div><div class="history-editor hidden"><label class="editor-field"><span>งานต้นฉบับ</span><textarea class="source-work">${escapeHtml(entry.workText || '')}</textarea></label><label class="editor-field"><span>สิ่งที่ติดขัด</span><textarea class="source-blocker">${escapeHtml(entry.blockerText || '')}</textarea></label><label class="editor-field"><span>งานถัดไป</span><textarea class="source-next">${escapeHtml(entry.nextText || '')}</textarea></label><label class="editor-field"><span>หรือแก้สรุปโดยตรง</span><textarea class="source-summary">${escapeHtml(entry.plainSummary)}</textarea></label><div><button class="history-cancel" type="button">ยกเลิก</button><button class="history-regenerate" type="button">สร้างสรุปใหม่จากต้นฉบับ</button><button class="history-save" type="button">บันทึกข้อความนี้</button></div></div></article>`).join('');
}
