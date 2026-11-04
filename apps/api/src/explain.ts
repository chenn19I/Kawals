import { templateExplanation, type Verdict } from '@kawal/rules';

export interface ExplanationResult {
  summary: string;
  details: string[];
  source: 'template' | 'llm';
}

export interface Explainer {
  explain(verdict: Verdict): ExplanationResult;
}

/**
 * F-06 tahap awal: penjelasan deterministik dari temuan.
 * LLM boleh ditambahkan nanti, tetapi tidak boleh mengubah verdict.
 */
export class TemplateExplainer implements Explainer {
  explain(verdict: Verdict): ExplanationResult {
    const explanation = templateExplanation(verdict);
    return {
      summary: explanation.summary,
      details: explanation.details,
      source: 'template',
    };
  }
}
