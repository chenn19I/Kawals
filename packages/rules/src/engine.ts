import {
  isCoinType,
  normalizeAddress,
  safeNormalizeAddress,
  shortAddress,
} from './address';
import { formatSui } from './amount';
import { resolvePolicy } from './policy';
import type {
  Decision,
  EvaluationInput,
  Finding,
  MemoryRef,
  RuleId,
  Verdict,
} from './types';

const DECISION_WEIGHT: Record<Decision, number> = {
  LOLOS: 0,
  TAHAN: 1,
  TOLAK: 2,
};

/**
 * Mesin aturan deterministik R1-R9.
 *
 * Murni: tanpa I/O, tanpa waktu, tanpa acak. Input yang sama selalu
 * menghasilkan putusan yang sama. LLM tidak pernah memanggil fungsi ini.
 *
 * Urutan: R1 menghentikan evaluasi. R2-R7 dikumpulkan semua agar slip
 * menampilkan seluruh temuan, lalu putusan terberat menang. R8 dan R9
 * hanya berlaku bila R1-R7 tidak memicu.
 */
export function evaluate(input: EvaluationInput): Verdict {
  const { transfer, simulation } = input;
  const findings: Finding[] = [];
  const cited = new Map<string, MemoryRef>();

  const cite = (memory?: MemoryRef): string[] => {
    if (!memory) return [];
    cited.set(memory.id, memory);
    return [memory.id];
  };

  if (simulation.status !== 'success') {
    const fallback =
      simulation.status === 'timeout' ? 'jaringan tidak menjawab' : 'simulasi tidak berhasil';
    const reason = trimPeriod(compactText(simulation.failureReason ?? '', 160) || fallback);

    findings.push({
      rule: 'R1',
      decision: 'TOLAK',
      message: `Simulasi gagal: ${reason}. Transaksi tidak bisa diperiksa.`,
      evidence: {
        status: simulation.status,
        reason,
        ...(simulation.failureCode ? { failureCode: simulation.failureCode } : {}),
      },
      memoryIds: [],
    });

    return buildVerdict(findings, cited);
  }

  const policy = resolvePolicy(input.policy);
  const recipient = normalizeAddress(transfer.recipient);
  const amount = transfer.amountMist;

  const denied = policy.denyList.find((entry) => entry.address === recipient);
  if (denied) {
    findings.push({
      rule: 'R2',
      decision: 'TOLAK',
      message: `Alamat ${shortAddress(recipient)} ada di daftar tolakmu.`,
      evidence: { address: recipient, shortAddress: shortAddress(recipient) },
      memoryIds: cite(denied.memory),
    });
  }

  if (simulation.totalOutflowMist > policy.maxOutflow.mist) {
    findings.push({
      rule: 'R3',
      decision: 'TAHAN',
      message:
        `Saldo keluar ${formatSui(simulation.totalOutflowMist)} SUI melebihi ` +
        `ambang pribadimu ${formatSui(policy.maxOutflow.mist)} SUI.`,
      evidence: {
        outflowSui: formatSui(simulation.totalOutflowMist),
        thresholdSui: formatSui(policy.maxOutflow.mist),
      },
      memoryIds: cite(policy.maxOutflow.memory),
    });
  }

  if (!input.history.hasSentToRecipientBefore && amount > policy.newRecipientMax.mist) {
    findings.push({
      rule: 'R4',
      decision: 'TAHAN',
      message:
        `Penerima belum pernah kamu kirimi dan jumlah ${formatSui(amount)} SUI ` +
        `di atas ambang penerima baru ${formatSui(policy.newRecipientMax.mist)} SUI.`,
      evidence: {
        amountSui: formatSui(amount),
        thresholdSui: formatSui(policy.newRecipientMax.mist),
      },
      memoryIds: cite(policy.newRecipientMax.memory),
    });
  }

  const unknownPackages = simulation.calledPackages.filter((pkg) => {
    const normalized = safeNormalizeAddress(pkg);
    return normalized === null || !policy.knownPackages.includes(normalized);
  });

  if (unknownPackages.length > 0) {
    findings.push({
      rule: 'R5',
      decision: 'TAHAN',
      message:
        'Transaksi memanggil paket Move yang belum dikenal: ' +
        `${unknownPackages.map(packageLabel).join(', ')}.`,
      evidence: { packages: unknownPackages.join(', ') },
      memoryIds: [],
    });
  }

  const foreignObjects = simulation.leavingObjects.filter(
    (object) => !isCoinType(object.objectType),
  );

  if (foreignObjects.length > 0) {
    findings.push({
      rule: 'R6',
      decision: 'TAHAN',
      message: `Transaksi memindahkan ${foreignObjects.length} objek milikmu selain koin.`,
      evidence: {
        objectIds: foreignObjects.map((object) => object.objectId).join(', '),
        objectTypes: foreignObjects.map((object) => object.objectType).join(', '),
      },
      memoryIds: [],
    });
  }

  if (input.risk?.dangerous === true) {
    const source = compactText(input.risk.source, 80) || 'sumber data';
    findings.push({
      rule: 'R7',
      decision: 'TAHAN',
      message: `Alamat penerima ditandai berbahaya oleh ${source}.`,
      evidence: { source },
      memoryIds: [],
    });
  }

  if (findings.length === 0) {
    const trusted = policy.trustList.find((entry) => entry.address === recipient);

    if (trusted && amount < policy.trustedMax.mist) {
      findings.push({
        rule: 'R8',
        decision: 'LOLOS',
        message:
          `Penerima ada di daftar dipercaya dan jumlah ${formatSui(amount)} SUI ` +
          `di bawah batas ${formatSui(policy.trustedMax.mist)} SUI.`,
        evidence: {
          amountSui: formatSui(amount),
          limitSui: formatSui(policy.trustedMax.mist),
        },
        memoryIds: [...cite(trusted.memory), ...cite(policy.trustedMax.memory)],
      });
    } else {
      findings.push({
        rule: 'R9',
        decision: 'TAHAN',
        message: 'Tidak ada aturan yang cocok. Bawaan aman: tahan dulu.',
        evidence: {
          shortAddress: shortAddress(recipient),
          amountSui: formatSui(amount),
        },
        memoryIds: [],
      });
    }
  }

  return buildVerdict(findings, cited);
}

function buildVerdict(findings: Finding[], cited: Map<string, MemoryRef>): Verdict {
  let decision: Decision = 'LOLOS';
  for (const finding of findings) {
    if (DECISION_WEIGHT[finding.decision] > DECISION_WEIGHT[decision]) {
      decision = finding.decision;
    }
  }

  return {
    decision,
    triggered: [...new Set(findings.map((finding) => finding.rule))] as RuleId[],
    findings,
    usedMemories: [...cited.values()],
  };
}

function packageLabel(raw: string): string {
  const normalized = safeNormalizeAddress(raw);
  if (normalized) return shortAddress(normalized);

  const compact = compactText(raw, 24);
  return compact || '(paket tidak terbaca)';
}

function compactText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
}

function trimPeriod(value: string): string {
  return value.replace(/[.]+$/, '');
}
