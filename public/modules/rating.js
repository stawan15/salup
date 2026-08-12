export function createRatingController({
  getEntries,
  saveEntries,
  updateRemoteRating,
  getCurrentResult,
  setCurrentResult,
  renderHistory,
  renderLearningStatus,
  showToast,
  getElement,
  getThaiDate,
  getToday,
  getResultEditing,
  setResultEditing,
}) {
  const ratingStars = (rating = null, enabled = true) => [1, 2, 3, 4, 5]
    .map((value) => `<button type="button" class="rating-star ${value <= (rating || 0) ? 'is-selected' : ''}" data-rating="${value}" aria-label="${value} ดาว" aria-pressed="${value <= (rating || 0)}" ${enabled ? '' : 'disabled'}>★</button>`)
    .join('');

  const paintRating = (container, rating = null, preview = false) => {
    container?.querySelectorAll('.rating-star').forEach((star) => {
      const value = Number(star.dataset.rating);
      star.classList.toggle('is-selected', value <= (rating || 0));
      star.classList.toggle('is-preview', preview && value <= (rating || 0));
      star.setAttribute('aria-pressed', String(value <= (rating || 0)));
    });
  };

  const persistRating = (entry, rating, feedback) => {
    const updated = { ...entry, rating, feedback };
    saveEntries(getEntries().map((candidate) => ((candidate.id && entry.id && candidate.id === entry.id) || candidate.createdAt === entry.createdAt ? { ...candidate, rating, feedback } : candidate)));
    if (entry === getCurrentResult() || (getCurrentResult()?.id && entry.id && getCurrentResult().id === entry.id)) setCurrentResult(updated);
    return updated;
  };

  const bindRating = (container, getEntry) => {
    if (!container) return;
    const stars = container.querySelector('.rating-stars');
    stars?.addEventListener('pointerover', (event) => {
      const button = event.target.closest('.rating-star');
      if (button && !button.disabled) paintRating(container, Number(button.dataset.rating), true);
    });
    stars?.addEventListener('pointerleave', () => paintRating(container, getEntry()?.rating || null));
    container.querySelectorAll('.rating-star').forEach((button) => button.addEventListener('click', async () => {
      const entry = getEntry();
      if (!entry) return showToast('ยังไม่มีสรุปให้รีวิว');
      const rating = Number(button.dataset.rating);
      const previousRating = entry.rating || null;
      const feedback = container.querySelector('.feedback-select')?.value || '';
      paintRating(container, rating);
      container.classList.add('is-saving');
      const result = await updateRemoteRating(entry.id, rating, feedback);
      container.classList.remove('is-saving');
      if (result.error) {
        paintRating(container, previousRating);
        return showToast(`บันทึกคะแนนไม่ได้: ${result.error.message}`);
      }
      const updatedEntry = persistRating(entry, rating, feedback);
      renderLearningStatus();
      if (entry === getCurrentResult()) renderResultRating(updatedEntry.rating, true);
      if (container.closest('.history-item') || getElement('historyView').style.display !== 'none') renderHistory();
      showToast(`บันทึกคะแนน ${rating}/5 แล้ว ระบบจะนำไปปรับสำนวนครั้งถัดไป`);
    }));
  };

  const renderResultRating = (rating = null, hasResult = Boolean(getCurrentResult())) => {
    const container = getElement('resultRating');
    if (!container) return;
    container.classList.toggle('is-disabled', !hasResult);
    container.querySelector('.rating-stars').innerHTML = ratingStars(rating, hasResult);
    const feedback = container.querySelector('.feedback-select');
    feedback.value = getCurrentResult()?.feedback || '';
    feedback.disabled = !hasResult;
    bindRating(container, getCurrentResult);
  };

  const resetCurrentResult = () => {
    setCurrentResult(null);
    setResultEditing(false);
    getElement('summaryBox').contentEditable = 'false';
    getElement('summaryBox').classList.remove('is-editing');
    getElement('summaryBox').innerHTML = '<div class="summary-placeholder">สรุปของวันนี้จะแสดงตรงนี้<br /><small>กรอกข้อมูลด้านบนแล้วกด “สรุปงาน”</small></div>';
    getElement('resultTitle').textContent = `สรุปการทำงาน · ${getThaiDate().format(getToday())}`;
    getElement('savedTime').textContent = 'ยังไม่มีการสรุปวันนี้';
    getElement('retrySaveBtn').classList.add('hidden');
    getElement('editBtn').textContent = 'แก้ไขสรุป';
    renderResultRating(null, false);
  };

  return { ratingStars, paintRating, persistRating, bindRating, renderResultRating, resetCurrentResult };
}
