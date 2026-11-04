import type { MemoryKind } from '@kawal/rules';
import type { EvaluationSummary, MemoryRef } from './api';
import type { Lang } from './i18n';

/**
 * A memory id is stable for the lifetime of the record. The printed cell code
 * is derived from that id, never from the position in a list, so forgetting a
 * cell never renumbers the other cells.
 */
export function cellCode(id: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const value = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `SEL-${value.slice(0, 4)}`;
}

export interface CellUsage {
  count: number;
  lastUsedAt: string | null;
}

/** Counts only citations present in logged evaluations. */
export function usageFromEvaluations(
  evaluations: readonly EvaluationSummary[],
): Map<string, CellUsage> {
  const usage = new Map<string, CellUsage>();
  for (const evaluation of evaluations) {
    for (const memory of evaluation.verdict.usedMemories) {
      const current = usage.get(memory.id) ?? { count: 0, lastUsedAt: null };
      current.count += 1;
      if (!current.lastUsedAt || evaluation.createdAt > current.lastUsedAt) {
        current.lastUsedAt = evaluation.createdAt;
      }
      usage.set(memory.id, current);
    }
  }
  return usage;
}

const KIND_REASON: Record<MemoryKind, { en: string; id: string }> = {
  alamat: {
    en: 'the recipient address matches this address cell',
    id: 'alamat penerima sama dengan sel alamat ini',
  },
  aturan: {
    en: 'this rule supplied the limit used by the engine',
    id: 'aturan ini memberi batas yang dipakai mesin',
  },
  keputusan: {
    en: 'an earlier decision is attached to this recipient',
    id: 'keputusan sebelumnya terhubung dengan penerima ini',
  },
  preferensi: {
    en: 'a saved preference is attached to this check',
    id: 'preferensi tersimpan terhubung dengan pemeriksaan ini',
  },
};

export function cellReason(memory: MemoryRef, lang: Lang): string {
  const reason = KIND_REASON[memory.kind];
  return lang === 'en'
    ? `Used because ${reason.en}.`
    : `Dipakai karena ${reason.id}.`;
}
