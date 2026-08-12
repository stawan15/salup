import test from 'node:test';
import assert from 'node:assert/strict';
import { createRatingController } from '../public/modules/rating.js';

test('rating controller renders five disabled stars without a result', () => {
  const elements = {
    resultRating: {
      classList: { toggle() {} },
      querySelector(selector) {
        if (selector === '.rating-stars') return { innerHTML: '' };
        return { value: '', disabled: false };
      },
      querySelectorAll() { return []; },
    },
  };
  const controller = createRatingController({
    getEntries: () => [],
    saveEntries: () => {},
    updateRemoteRating: async () => ({ error: null }),
    getCurrentResult: () => null,
    setCurrentResult: () => {},
    renderHistory: () => {},
    renderLearningStatus: () => {},
    showToast: () => {},
    getElement: (id) => elements[id],
    getThaiDate: () => ({ format: () => 'วันนี้' }),
    getToday: () => new Date(),
    getResultEditing: () => false,
    setResultEditing: () => {},
  });
  const stars = controller.ratingStars(null, false);
  assert.equal((stars.match(/class="rating-star/g) || []).length, 5);
  assert.equal((stars.match(/disabled/g) || []).length, 5);
});
