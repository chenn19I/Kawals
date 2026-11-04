import { useEffect, useState, type ReactElement } from 'react';
import { sui, type Decision } from '@kawal/rules';
import { useLang } from '../lib/i18n';
import {
  createMemory,
  fetchDecisions,
  fetchEvaluations,
  type EvaluationSummary,
} from '../lib/api';
import { cellCode } from '../lib/cells';
import { errorText } from '../lib/errors';
import { formatRelative } from '../lib/format';
import { AgreementDial } from './AgreementDial';
import { DecisionStamp } from './DecisionStamp';
import { Icon } from './Icon';
import { Button } from './Button';

export function LearningCurveScreen(): ReactElement {
  const { tx, lang } = useLang();
  const [decisions, setDecisions] = useState<
    Array<{ decision: Decision; engineDecision: Decision; createdAt: string }>
  >([]);
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [recorded, setRecorded] = useState(false);
  const [writing, setWriting] = useState(false);
  const [recordNote, setRecordNote] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);
    fetchEvaluations(500, controller.signal)
      .then((next) => {
        if (!alive) return;
        setEvaluations(next);
      })
      .catch((caught) => {
        if (!alive || (caught instanceof DOMException && caught.name === 'AbortError')) return;
        setError(caught);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDecisions(200, controller.signal)
      .then((body) => {
        if (!alive) return;
        const items = body.slice(0, 200);
        const mapped = items.map((item) => ({
          decision: item.decision,
          engineDecision: item.engineDecision,
          createdAt: item.createdAt,
        }));
        setDecisions(mapped);
      })
      .catch((caught) => {
        if (!alive || (caught instanceof DOMException && caught.name === 'AbortError')) return;
        setError(caught);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const record = async (): Promise<void> => {
    if (recorded || writing) return;
    setWriting(true);
    setRecordError(null);
    try {
      const result = await createMemory({
        kind: 'aturan',
        statement:
          'Pertanyaan sesi: jangan kirim nominal asing ke penjual baru. Batas penerima baru 1 SUI.',
        statementEn:
          "Session question: do not send an unknown amount to a new seller. New-recipient limit 1 SUI.",
        threshold: { appliesTo: ['newRecipientMax'], mist: sui('1').toString() },
      });
      setRecorded(true);
      setRecordNote(
        tx(
          `Cell ${cellCode(result.memory.record.id)} was written. Blob ${result.write.blobId.slice(0, 12)}...`,
          `Sel ${cellCode(result.memory.record.id)} tertulis. Blob ${result.write.blobId.slice(0, 12)}...`,
        ),
      );
    } catch (caught) {
      setRecordError(caught);
    } finally {
      setWriting(false);
    }
  };

  const holds = decisions.filter((item) => item.decision === 'TAHAN');
  const rejects = decisions.filter((item) => item.decision === 'TOLAK');
  const passes = decisions.filter((item) => item.decision === 'LOLOS');
  const matched = decisions.filter((item) => item.decision === item.engineDecision).length;
  const alignedPercent = decisions.length
    ? Math.round((matched / decisions.length) * 100)
    : 0;
  const triggers = new Map<string, number>();
  for (const evaluation of evaluations) {
    for (const rule of evaluation.verdict.triggered) {
      triggers.set(rule, (triggers.get(rule) ?? 0) + 1);
    }
  }
  const totalTriggers = [...triggers.values()].reduce((sum, count) => sum + count, 0);
  const topRule = [...triggers.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="learning-screen">
      <header className="page-intro page-intro--split">
        <div>
          <p className="eyebrow">{tx('Learning curve', 'Kurva belajar')}</p>
          <h1>{tx('One question, every time.', 'Satu pertanyaan, tiap pemeriksaan.')}</h1>
          <p>
            {tx(
              'Each session asks a hold question. Your agreement records a memory. The curve counts only what the server logged.',
              'Setiap sesi mengajukan pertanyaan tahan. Persetujuanmu mencatat memori. Kurva hanya menghitung yang tercatat di server.',
            )}
          </p>
        </div>
        <div className="learning-card">
          <div className="learning-card__head">
            <span className="learning-card__key mono">{tx('rules fired', 'aturan yang menyala')}</span>
            <span className="learning-card__value mono">{topRule?.[0] ?? 'R9'}</span>
          </div>
          <dl className="learning-detail">
            <div>
              <dt>{tx('Holds', 'Penahanan')}</dt>
              <dd className="mono">{holds.length}</dd>
            </div>
            <div>
              <dt>{tx('Passes', 'Lolos')}</dt>
              <dd className="mono">{passes.length}</dd>
            </div>
            <div>
              <dt>{tx('Rejects', 'Tolak')}</dt>
              <dd className="mono">{rejects.length}</dd>
            </div>
            <div>
              <dt>{tx('Decisions', 'Keputusan')}</dt>
              <dd className="mono">{decisions.length}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="panel learning-panel">
        <div className="panel__head">
          <div>
            <p className="eyebrow">{tx('Session question', 'Pertanyaan sesi')}</p>
            <h2>{tx('Ask once per session, one hold.', 'Ajukan sekali per sesi, satu tahan.')}</h2>
          </div>
        </div>
        <div className="learning-question">
          <div className="learning-question__dial">
            <span className="learning-question__ask">
              {tx("Don't send an unknown amount to a new seller", 'Jangan kirim jumlah asing ke penjual baru')}
            </span>
            <div className="learning-question__ring">
              <span className="learning-question__needle" style={{ transform: 'rotate(140deg)' }} />
              <span className="learning-question__base" />
              <span className="learning-question__mark">{tx("Don't send", 'Jangan kirim')}</span>
              <span className="learning-question__mark">{tx('Do send', 'Kirim')}</span>
            </div>
          </div>
          <div className="learning-question__agree">
            <button
              type="button"
              role="switch"
              aria-checked={recorded}
              className="learning-question__switch"
              disabled={recorded || writing}
              onClick={() => void record()}
            >
              <span className={`learning-question__track ${recorded ? 'is-agreed' : ''}`}>
                <span className={`learning-question__thumb ${recorded ? 'is-agreed' : ''}`} />
              </span>
              {writing
                ? tx('Writing memory...', 'Menulis memori...')
                : recorded
                  ? tx('Agreed and remembered', 'Disetujui dan diingat')
                  : tx('Agree to hold this question', 'Setujui tahan pertanyaan ini')}
            </button>
            <p className="learning-question__hint">
              {tx(
                'This writes a new-recipient rule of 1 SUI to the same memory store the checks use.',
                'Ini menulis aturan penerima baru 1 SUI ke penyimpanan memori yang dipakai pemeriksaan.',
              )}
            </p>
          </div>
        </div>
        {recorded ? (
          <div className="learning-recorded">
            <span className="learning-recorded__stamp decision-stamp decision-stamp--hold">
              <Icon name="pause" size={14} />
              <span>{tx('Hold', 'Tahan')}</span>
            </span>
            <p>
              {recordNote ??
                tx(
                  'A memory is remembered. The curve can only count what the server recorded.',
                  'Memori berhasil diingat. Kurva hanya menghitung yang tercatat di server.',
                )}
            </p>
          </div>
        ) : null}
        {recordError ? (
          <p className="form-error" role="alert">
            {errorText(recordError, lang)}
          </p>
        ) : null}
      </section>

      <section className="panel learning-panel" aria-labelledby="agreement-title">
        <div className="panel__head">
          <div>
            <p className="eyebrow">{tx('Agreement', 'Kesesuaian')}</p>
            <h2 id="agreement-title">
              {tx('Where you follow the engine, and where you do not.', 'Saat kamu mengikuti mesin, dan saat tidak.')}
            </h2>
          </div>
        </div>
        <div className="agreement-row">
          <AgreementDial matched={matched} total={decisions.length} />
          <div className="agreement-copy">
            <strong className="agreement-copy__value mono">{alignedPercent}%</strong>
            <p>
              {decisions.length
                ? tx(
                    `${matched} of ${decisions.length} saved decisions match the engine recommendation. Every override still counts in the history below.`,
                    `${matched} dari ${decisions.length} keputusan tersimpan sejalan dengan rekomendasi mesin. Setiap perbedaan tetap dihitung di riwayat bawah.`,
                  )
                : tx(
                    'No saved decision yet. Run a check and record what you choose.',
                    'Belum ada keputusan tersimpan. Jalankan pemeriksaan dan catat pilihanmu.',
                  )}
            </p>
            <span className="mono agreement-copy__note">
              {tx('Engine verdict vs your decision', 'Putusan mesin vs keputusanmu')}
            </span>
          </div>
        </div>
      </section>

      <section className="panel learning-panel">
        <div className="panel__head">
          <div>
            <p className="eyebrow">{tx('Rule frequency', 'Frekuensi aturan')}</p>
            <h2>{tx('Which rules fire most', 'Aturan mana yang paling sering menyala')}</h2>
          </div>
        </div>
        {topRule ? (
          <div className="learning-top-rule">
            <span className="learning-top-rule__id mono">{topRule[0]}</span>
            <div>
              <strong>{ruleNameFor(topRule[0], lang)}</strong>
              <p>{tx(`fired ${topRule[1]} times`, `${topRule[1]} kali menyala`)}</p>
            </div>
          </div>
        ) : (
          <p className="learning-empty">{tx('No rules recorded yet', 'Belum ada aturan tercatat')}</p>
        )}
        <div className="learning-rule-list">
          {Array.from(triggers.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([rule, count]) => (
              <div key={rule} className="learning-rule-row">
                <span className="learning-rule-row__id mono">{rule}</span>
                <div className="learning-rule-row__bar">
                  <span
                    className="learning-rule-row__fill"
                    style={{ width: totalTriggers ? `${(count / totalTriggers) * 100}%` : '0%' }}
                  />
                </div>
                <span className="learning-rule-row__count mono">{count}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="panel learning-panel">
        <div className="panel__head">
          <div>
            <p className="eyebrow">{tx('History', 'Riwayat')}</p>
            <h2>{tx('Checks, decisions, memories, again', 'Pemeriksaan, keputusan, ingatan, lagi')}</h2>
          </div>
        </div>
        {decisions.length === 0 ? (
          <div className="state-block">
            <Icon name="clock" size={24} />
            <p>{tx('No checks recorded yet', 'Belum ada pemeriksaan tercatat')}</p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              {tx('Go do a check', 'Lakukan pemeriksaan')}
            </Button>
          </div>
        ) : (
          <ul className="learning-history">
            {decisions.map((item, index) => (
              <li key={`${item.createdAt}-${index}`} className="learning-history__row">
                <span className="learning-history__step mono">{index + 1}</span>
                <div className="learning-history__body">
                  <div className="learning-history__top">
                    <DecisionStamp decision={item.decision} size="sm" />
                    <span className="learning-history__time">{formatRelative(item.createdAt, lang)}</span>
                  </div>
                  <p className="learning-history__note">
                    {tx('Your decision', 'Keputusanmu')}: <strong>{item.decision}</strong>
                    <span className="learning-history__engine mono">
                      {tx('Engine', 'Mesin')} {item.engineDecision}
                    </span>
                  </p>
                </div>
                <span className="learning-history__icon">
                  <Icon name="memory" size={16} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="learning-footnote">
        {tx(
          'Numbers come only from saved decisions. Nothing here is estimated or invented.',
          'Angka hanya dari keputusan yang tersimpan. Tidak ada yang diperkirakan atau dibuat-buat di sini.',
        )}
      </p>
    </div>
  );
}

function ruleNameFor(id: string, lang: 'en' | 'id'): string {
  return id === 'R2'
    ? lang === 'en'
      ? 'Deny list'
      : 'Daftar tolak'
    : lang === 'en'
      ? `Rule ${id}`
      : `Aturan ${id}`;
}
