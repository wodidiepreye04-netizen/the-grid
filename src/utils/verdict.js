/** THE GRID — Verdict Generator */

/**
 * Generate a plain-language performance verdict. No flattery.
 * @param {number} pct - Completion percentage (0-100)
 * @param {number} skipped - Number of skipped blocks
 * @param {number} total - Total blocks scheduled
 * @returns {string} verdict
 */
export function generateVerdict(pct, skipped, total) {
  if (total === 0) return 'No blocks were scheduled. A day without structure is a day without progress.';

  if (pct === 100) return 'Full execution. Every block completed. This is the standard — maintain it.';
  if (pct >= 90) return 'Near-perfect execution. Minor gaps but the discipline held. Stay sharp.';
  if (pct >= 75) return 'Acceptable performance. The target was met but there is room for tighter execution.';
  if (pct >= 60) return `Below target. ${skipped} block${skipped !== 1 ? 's' : ''} skipped. The structure cracked — identify where and stop the leak.`;
  if (pct >= 40) return `Weak day. More blocks were missed than should be tolerable. Discipline broke down. Diagnose the cause.`;
  if (pct >= 20) return `Poor execution. The grid was largely abandoned. This is the pattern that leads to stagnation.`;
  return `Day failed. ${skipped} of ${total} blocks skipped. This is not a productivity issue — it is a discipline issue. Rebuild tomorrow.`;
}

/**
 * Generate a recommendation based on patterns
 */
export function generateRecommendation(blocks, checkIns) {
  // Find most-skipped category
  const skipsByCategory = {};
  for (const block of blocks) {
    const ci = checkIns.find(c => c.block_id === block.id);
    if (ci?.response === 'skipped' || block.status === 'skipped') {
      skipsByCategory[block.category] = (skipsByCategory[block.category] || 0) + 1;
    }
  }

  const topSkip = Object.entries(skipsByCategory).sort((a, b) => b[1] - a[1])[0];

  if (!topSkip) return 'Maintain current structure. No critical pattern detected.';

  const categoryNames = {
    prayer: 'Prayer', bible_study: 'Bible Study', reading: 'Reading',
    writing: 'Writing', exercise: 'Exercise', deep_work: 'Deep Work',
    admin: 'Admin', meals: 'Meals', rest: 'Rest', other: 'Other',
  };

  return `Focus on ${categoryNames[topSkip[0]] || topSkip[0]} blocks tomorrow. This category was skipped ${topSkip[1]} time${topSkip[1] !== 1 ? 's' : ''} today. Either reduce the number of those blocks or commit harder. No middle ground.`;
}
