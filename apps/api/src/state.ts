import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MemoryRecord } from '@kawal/rules';
import type {
  DecisionRecord,
  EvaluationRecord,
  MemoryCatalogEntry,
  MemoryWriteState,
  StateData,
} from './types';

function emptyState(): StateData {
  return {
    evaluations: [],
    decisions: [],
    memoryCatalog: [],
    forgotten: [],
    revoked: false,
  };
}

function loadState(file: string): StateData {
  if (!existsSync(file)) return emptyState();
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<StateData>;
  return {
    evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    memoryCatalog: Array.isArray(parsed.memoryCatalog) ? parsed.memoryCatalog : [],
    forgotten: Array.isArray(parsed.forgotten) ? parsed.forgotten : [],
    revoked: parsed.revoked === true,
  };
}

export class StateStore {
  private data: StateData;

  constructor(private readonly file: string | null = null) {
    this.data = file ? loadState(file) : emptyState();
  }

  private save(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  seedMemories(records: readonly MemoryRecord[]): void {
    if (this.data.memoryCatalog.length > 0) return;
    const createdAt = new Date().toISOString();
    this.data.memoryCatalog = records.map((record) => ({
      record,
      blobId: record.id,
      createdAt,
      forgotten: false,
      source: 'mock',
    }));
    this.save();
  }

  addEvaluation(record: EvaluationRecord): void {
    this.data.evaluations.unshift(record);
    if (this.data.evaluations.length > 200) this.data.evaluations.length = 200;
    this.save();
  }

  getEvaluation(id: string): EvaluationRecord | undefined {
    return this.data.evaluations.find((record) => record.id === id);
  }

  listEvaluations(limit = 50): EvaluationRecord[] {
    return this.data.evaluations.slice(0, limit);
  }

  addDecision(record: DecisionRecord): void {
    this.data.decisions.unshift(record);
    if (this.data.decisions.length > 500) this.data.decisions.length = 500;
    this.save();
  }

  getDecision(id: string): DecisionRecord | undefined {
    return this.data.decisions.find((record) => record.id === id);
  }

  listDecisions(limit = 50): DecisionRecord[] {
    return this.data.decisions.slice(0, limit);
  }

  updateDecisionMemory(id: string, memory: MemoryWriteState): void {
    const decision = this.data.decisions.find((record) => record.id === id);
    if (!decision) return;
    decision.memory = memory;
    this.save();
  }

  upsertMemory(entry: MemoryCatalogEntry): void {
    const index = this.data.memoryCatalog.findIndex(
      (item) => item.record.id === entry.record.id || item.blobId === entry.blobId,
    );
    if (index >= 0) {
      this.data.memoryCatalog[index] = entry;
    } else {
      this.data.memoryCatalog.push(entry);
    }
    this.save();
  }

  listMemories(includeForgotten = false): MemoryCatalogEntry[] {
    return this.data.memoryCatalog.filter(
      (entry) =>
        includeForgotten ||
        (!entry.forgotten && !this.isForgotten(entry.blobId, entry.record.id)),
    );
  }

  findMemory(idOrBlob: string): MemoryCatalogEntry | undefined {
    return this.data.memoryCatalog.find(
      (entry) => entry.record.id === idOrBlob || entry.blobId === idOrBlob,
    );
  }

  forgetMemory(idOrBlob: string): MemoryCatalogEntry | null {
    const entry = this.findMemory(idOrBlob);
    if (!entry) return null;
    entry.forgotten = true;
    for (const value of [entry.record.id, entry.blobId]) {
      if (!this.data.forgotten.includes(value)) this.data.forgotten.push(value);
    }
    this.save();
    return entry;
  }

  isForgotten(blobId: string, memoryId?: string): boolean {
    return (
      this.data.forgotten.includes(blobId) ||
      (memoryId !== undefined && this.data.forgotten.includes(memoryId))
    );
  }

  setRevoked(revoked: boolean): void {
    this.data.revoked = revoked;
    this.save();
  }

  isRevoked(): boolean {
    return this.data.revoked;
  }
}
