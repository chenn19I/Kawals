import type { Verdict } from './types';

export interface Explanation {
  summary: string;
  details: string[];
}

/**
 * Templat cadangan bila LLM gagal atau dimatikan (F-06).
 * Hanya menyalin temuan mesin aturan; tidak menambah putusan baru.
 */
export function templateExplanation(verdict: Verdict): Explanation {
  const [primary] = verdict.findings;
  if (!primary) {
    return { summary: 'Tidak ada temuan.', details: [] };
  }

  return {
    summary: primary.message,
    details: verdict.findings.map((finding) => finding.message),
  };
}
