import { describe, expect, it } from 'vitest';
import { evaluate } from '@kawal/rules';
import { scenarios } from '../src/index';

describe('fixture dApp tiruan', () => {
  it('berisi 12 skenario dengan id unik', () => {
    expect(scenarios).toHaveLength(12);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(12);
  });

  it.each(scenarios)('$id', (scenario) => {
    const verdict = evaluate(scenario.input);

    expect(verdict.decision).toBe(scenario.expected.decision);
    expect(verdict.triggered).toEqual(scenario.expected.rules);
  });

  it('tidak ada fixture berbahaya yang berakhir LOLOS', () => {
    const dangerous = scenarios.filter(
      (scenario) => scenario.expected.decision !== 'LOLOS',
    );

    expect(dangerous).toHaveLength(11);
    for (const scenario of dangerous) {
      expect(evaluate(scenario.input).decision, scenario.id).not.toBe('LOLOS');
    }
  });

  it('setiap putusan TOLAK punya temuan TOLAK, bukan hanya TAHAN', () => {
    for (const scenario of scenarios) {
      const verdict = evaluate(scenario.input);
      if (verdict.decision === 'TOLAK') {
        expect(
          verdict.findings.some((finding) => finding.decision === 'TOLAK'),
          scenario.id,
        ).toBe(true);
      }
    }
  });

  it('slip menampilkan memori hanya saat memori itu dipakai', () => {
    const byId = (id: string) => {
      const scenario = scenarios.find((candidate) => candidate.id === id);
      expect(scenario, id).toBeDefined();
      return scenario!;
    };

    expect(
      evaluate(byId('alamat-pernah-ditolak').input).usedMemories.map((memory) => memory.id),
    ).toEqual(['mem-alamat-ditolak']);
    expect(
      evaluate(byId('alamat-dipercaya').input).usedMemories.map((memory) => memory.id),
    ).toEqual(['mem-alamat-dipercaya']);
    expect(evaluate(byId('transfer-kecil-alamat-baru').input).usedMemories).toEqual([]);
  });
});
