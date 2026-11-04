import { formatSui, type ResolvedPolicy, type SimulationOutcome } from '@kawal/rules';
import type { Scenario } from '@kawal/fixtures';
import type {
  DecisionRecord,
  EvaluationRecord,
  MemoryCatalogEntry,
  PolicyDto,
  RecalledMemory,
  RecalledMemoryDto,
  SimulationDto,
} from './types';

export function toPolicyDto(policy: ResolvedPolicy): PolicyDto {
  return {
    denyList: policy.denyList.map((entry) => ({
      address: entry.address,
      ...(entry.memory ? { memory: entry.memory } : {}),
    })),
    trustList: policy.trustList.map((entry) => ({
      address: entry.address,
      ...(entry.memory ? { memory: entry.memory } : {}),
    })),
    knownPackages: [...policy.knownPackages],
    thresholds: {
      maxOutflow: {
        mist: policy.maxOutflow.mist.toString(),
        sui: formatSui(policy.maxOutflow.mist),
        ...(policy.maxOutflow.memory ? { memory: policy.maxOutflow.memory } : {}),
      },
      newRecipientMax: {
        mist: policy.newRecipientMax.mist.toString(),
        sui: formatSui(policy.newRecipientMax.mist),
        ...(policy.newRecipientMax.memory ? { memory: policy.newRecipientMax.memory } : {}),
      },
      trustedMax: {
        mist: policy.trustedMax.mist.toString(),
        sui: formatSui(policy.trustedMax.mist),
        ...(policy.trustedMax.memory ? { memory: policy.trustedMax.memory } : {}),
      },
    },
  };
}

export function toSimulationDto(simulation: SimulationOutcome): SimulationDto {
  return {
    status: simulation.status,
    ...(simulation.failureReason ? { failureReason: simulation.failureReason } : {}),
    ...(simulation.failureCode ? { failureCode: simulation.failureCode } : {}),
    totalOutflowMist: simulation.totalOutflowMist.toString(),
    totalOutflowSui: formatSui(simulation.totalOutflowMist),
    calledPackages: [...simulation.calledPackages],
    leavingObjects: simulation.leavingObjects.map((object) => ({ ...object })),
  };
}

export function toRecalledMemoryDto(memory: RecalledMemory): RecalledMemoryDto {
  return {
    id: memory.id,
    kind: memory.kind,
    statement: memory.statement,
    ...(memory.statementEn ? { statementEn: memory.statementEn } : {}),
    ...(memory.data ? { data: memory.data } : {}),
    blobId: memory.blobId,
    distance: memory.distance,
    createdAt: memory.createdAt,
  };
}

export function toEvaluationDto(record: EvaluationRecord): EvaluationRecord {
  return {
    ...record,
    memories: record.memories.map((memory) => ({ ...memory })),
  };
}

export function toDecisionDto(record: DecisionRecord): DecisionRecord {
  return {
    ...record,
    memory: { ...record.memory },
  };
}

export function toMemoryCatalogDto(entry: MemoryCatalogEntry): MemoryCatalogEntry {
  return {
    ...entry,
    record: {
      ...entry.record,
      ...(entry.record.data ? { data: { ...entry.record.data } } : {}),
    },
  };
}

export function toScenarioDto(scenario: Scenario): {
  id: string;
  dapp: string;
  dappEn: string;
  title: string;
  titleEn: string;
  note: string;
  noteEn: string;
  expected: Scenario['expected'];
} {
  return {
    id: scenario.id,
    dapp: scenario.dapp,
    dappEn: scenario.dappEn,
    title: scenario.title,
    titleEn: scenario.titleEn,
    note: scenario.note,
    noteEn: scenario.noteEn,
    expected: scenario.expected,
  };
}
