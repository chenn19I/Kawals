import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import type { Decision } from '@kawal/rules';
import { scenarios } from '@kawal/fixtures';
import { useLang } from '../lib/i18n';
import {
  fetchDecisions,
  recordDecision,
  runScenario,
  type DecisionListItem,
  type DecisionRecord,
  type Evaluation,
} from '../lib/api';
import { cellCode } from '../lib/cells';
import { DECISION_COPY, decisionCopy } from '../lib/copy';
import { errorText } from '../lib/errors';
import { findingText, ruleName } from '../lib/findings';
import { formatDateTime, formatSuiAmount, shortBlob } from '../lib/format';
import { Address } from './Address';
import { Button } from './Button';
import { DecisionStamp } from './DecisionStamp';
import { Icon } from './Icon';
import { ScanBay, type ScanPhase } from './ScanBay';

type Filter = 'all' | 'lolos' | 'tahan' | 'tolak' | 'belum';
type Scenario = (typeof scenarios)[number];

const FILTERS: Array<{ key: Filter; en: string; id: string }> = [
  { key: 'all', en: 'All', id: 'Semua' },
  { key: 'lolos', en: 'Pass', id: 'Lolos' },
  { key: 'tahan', en: 'Hold', id: 'Tahan' },
  { key: 'tolak', en: 'Reject', id: 'Tolak' },
  { key: 'belum', en: 'Not checked', id: 'Belum diperiksa' },
];

const DECISION_TO_FILTER: Record<Decision, Filter> = {
  LOLOS: 'lolos',
  TAHAN: 'tahan',
  TOLAK: 'tolak',
};

function shortTitle(text: string): string {
  return text.length > 64 ? `${text.slice(0, 63)}...` : text;
}

function scenarioCode(id: string): string {
  const index = scenarios.findIndex((scenario) => scenario.id === id);
  return `CASE / ${String(index + 1).padStart(2, '0')}`;
}

function caseTone(decision: Decision): 'pass' | 'hold' | 'block' {
  return DECISION_COPY[decision].tone;
}

export function MarketScreen(): ReactElement {
  const { tx, lang } = useLang();
  const [decisions, setDecisions] = useState<DecisionListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  const [selected, setSelected] = useState<Scenario | null>(null);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [stage, setStage] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [caseError, setCaseError] = useState<unknown>(null);
  const [recording, setRecording] = useState<Decision | null>(null);
  const [recorded, setRecorded] = useState<DecisionRecord | null>(null);
  const [recordError, setRecordError] = useState<unknown>(null);
  const [rememberStance, setRememberStance] = useState(true);

  const timers = useRef<number[]>([]);
  const caseToken = useRef(0);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDecisions(100, controller.signal)
      .then((next) => {
        if (alive) setDecisions(next);
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
  }, [refreshToken]);

  const clearTimers = useCallback((): void => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  const closeCase = useCallback((): void => {
    caseToken.current += 1;
    clearTimers();
    setSelected(null);
    setPhase('idle');
    setStage(0);
    setEvaluation(null);
    setCaseError(null);
    setRecording(null);
    setRecorded(null);
    setRecordError(null);
  }, [clearTimers]);

  const lastDecision = useCallback(
    (scenario: Scenario): DecisionListItem | undefined =>
      (decisions ?? []).find(
        (item) =>
          item.transfer.recipient === scenario.input.transfer.recipient &&
          item.transfer.amountMist === scenario.input.transfer.amountMist.toString(),
      ),
    [decisions],
  );

  const openCase = useCallback(
    (scenario: Scenario): void => {
      caseToken.current += 1;
      const token = caseToken.current;
      clearTimers();
      restoreFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSelected(scenario);
      setPhase('scanning');
      setStage(0);
      setEvaluation(null);
      setCaseError(null);
      setRecording(null);
      setRecorded(null);
      setRecordError(null);
      setRememberStance(true);

      for (let index = 1; index < 4; index += 1) {
        timers.current.push(window.setTimeout(() => setStage(index), index * 720));
      }

      const started = Date.now();
      void runScenario(scenario.id)
        .then(async (next) => {
          const remaining = Math.max(0, 2800 - (Date.now() - started));
          if (remaining > 0) {
            await new Promise<void>((resolve) => {
              timers.current.push(window.setTimeout(resolve, remaining));
            });
          }
          if (caseToken.current !== token) return;
          setEvaluation(next);
          setStage(3);
          setPhase('verdict');
        })
        .catch((caught) => {
          if (caseToken.current !== token) return;
          setCaseError(caught);
          setPhase('error');
        });
    },
    [clearTimers],
  );

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCase();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus();
    };
  }, [closeCase, selected]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const saveDecision = async (decision: Decision): Promise<void> => {
    if (!evaluation || recording || recorded) return;
    setRecording(decision);
    setRecordError(null);
    const stance =
      rememberStance && decision === 'TOLAK'
        ? 'deny'
        : rememberStance && decision === 'LOLOS'
          ? 'trust'
          : undefined;
    try {
      const result = await recordDecision({
        evaluationId: evaluation.id,
        decision,
        ...(stance ? { addressStance: stance } : {}),
      });
      setRecorded(result);
      setRefreshToken((value) => value + 1);
    } catch (caught) {
      setRecordError(caught);
    } finally {
      setRecording(null);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const base = scenarios.filter((scenario) => {
    if (!normalizedQuery) return true;
    const haystack = [
      scenario.id,
      scenario.title,
      scenario.titleEn ?? '',
      scenario.note,
      scenario.noteEn ?? '',
      scenario.input.transfer.recipient,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  const visible = base.filter((scenario) => {
    if (filter === 'all') return true;
    const recordedDecision = lastDecision(scenario);
    if (filter === 'belum') return !recordedDecision;
    if (!recordedDecision) return false;
    return DECISION_TO_FILTER[recordedDecision.decision] === filter;
  });
  const checkedCount = scenarios.filter((scenario) => Boolean(lastDecision(scenario))).length;

  return (
    <div className="market-screen">
      <header className="page-intro">
        <p className="eyebrow">{tx('Mock market', 'Pasar tiruan')}</p>
        <h1>{tx('Twelve fixtures, one checkpoint.', '12 fixture, satu pos pemeriksaan.')}</h1>
        <p>
          {tx(
            'Every card is a Pasar Tiruan fixture. Open one to watch the scanner read the transfer, recall your memory, and stamp the case file.',
            'Setiap kartu adalah fixture Pasar Tiruan. Buka satu untuk melihat pemindai membaca transfer, memanggil memorimu, dan memberi cap pada berkas kasus.',
          )}
        </p>
      </header>

      <div className="market-toolbar">
        <label className="market-search">
          <span className="search-icon" aria-hidden="true">
            <Icon name="scan" size={16} />
          </span>
          <span className="sr-only">{tx('Search fixtures', 'Cari fixture')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={tx('Search fixtures', 'Cari fixture')}
            placeholder={tx('Search a scenario...', 'Cari skenario...')}
          />
        </label>
        <span className="market-count mono" aria-live="polite">
          {tx(`${checkedCount} of 12 checked`, `${checkedCount} dari 12 diperiksa`)}
        </span>
      </div>

      <div
        className="filter-row"
        role="group"
        aria-label={tx('Filter by last decision', 'Saring berdasarkan putusan terakhir')}
      >
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filter === item.key ? 'is-active' : ''}
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
          >
            {lang === 'en' ? item.en : item.id}
          </button>
        ))}
      </div>

      <div className="market-grid">
        {loading && !decisions ? (
          <div className="state-block market-grid__empty">
            <span className="spinner" aria-hidden="true" />
            <p>{tx('Reading recorded decisions...', 'Membaca putusan tercatat...')}</p>
          </div>
        ) : error ? (
          <div className="state-block state-block--error market-grid__empty" role="alert">
            <Icon name="warning" size={22} />
            <h2>{tx('Decisions could not be read', 'Putusan tidak dapat dibaca')}</h2>
            <p>{errorText(error, lang)}</p>
            <Button variant="secondary" size="sm" onClick={() => setRefreshToken((value) => value + 1)}>
              {tx('Try again', 'Coba lagi')}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="state-block market-grid__empty">
            <Icon name="wallet" size={26} />
            <h2>{tx('No card matches this view', 'Tidak ada kartu yang cocok')}</h2>
            <p>
              {tx(
                'Change the search or filter, or open another fixture.',
                'Ubah pencarian atau filter, atau buka fixture lain.',
              )}
            </p>
          </div>
        ) : (
          visible.map((scenario) => {
            const last = lastDecision(scenario);
            const pending = !last;
            return (
              <article className={`market-card ${pending ? 'is-pending' : ''}`} key={scenario.id}>
                <div className="market-card__head">
                  <span className="mono market-card__id">
                    {scenario.id.replace(/^transfer-/, '').replace(/-/g, ' ')}
                  </span>
                  <span className="market-card__engine mono">
                    {tx('Fixture', 'Fixture')}
                  </span>
                </div>
                <h2 className="market-card__title">
                  {shortTitle(lang === 'en' ? scenario.titleEn ?? scenario.title : scenario.title)}
                </h2>
                <p className="market-card__note">
                  {lang === 'en' ? scenario.noteEn ?? scenario.note : scenario.note}
                </p>

                <div className="market-card__decisions">
                  {pending ? (
                    <span className="market-card__pending">
                      {tx('Not checked yet', 'Belum diperiksa')}
                    </span>
                  ) : (
                    <>
                      <DecisionStamp decision={last!.decision} size="sm" />
                      <span className="market-card__engine mono">
                        {tx('Last saved', 'Terakhir disimpan')}
                      </span>
                    </>
                  )}
                </div>

                <div className="market-card__values">
                  <span className="market-card__amount mono">
                    {formatSuiAmount(scenario.input.transfer.amountMist)} SUI
                  </span>
                  <span className="market-card__recipient mono">
                    <Address value={scenario.input.transfer.recipient} />
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  block
                  aria-haspopup="dialog"
                  onClick={() => openCase(scenario)}
                  icon={<Icon name="scan" size={16} />}
                >
                  {tx('Open case file', 'Buka berkas kasus')}
                </Button>
                <p className="market-card__hint">
                  {tx(
                    'The engine verdict is fixed. Your decision is recorded separately.',
                    'Putusan mesin tetap. Keputusanmu dicatat terpisah.',
                  )}
                </p>
              </article>
            );
          })
        )}
      </div>

      <p className="market-footnote">
        {tx(
          'Fixture data is labelled demo replay. The real Check screen uses Tatum and Walrus and is never replaced by this market.',
          'Data fixture diberi label demo replay. Layar Periksa yang asli memakai Tatum dan Walrus dan tidak digantikan oleh pasar ini.',
        )}
      </p>

      {selected ? (
        <div
          className="case-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCase();
          }}
        >
          <div
            className="case-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-title"
          >
            <header className="case-sheet__head">
              <div>
                <span className="mono case-sheet__code">{scenarioCode(selected.id)}</span>
                <h2 id="case-title">
                  {lang === 'en' ? selected.titleEn ?? selected.title : selected.title}
                </h2>
                <p>{lang === 'en' ? selected.noteEn ?? selected.note : selected.note}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="icon-button case-sheet__close"
                onClick={closeCase}
                aria-label={tx('Close case file', 'Tutup berkas kasus')}
              >
                <Icon name="x" size={18} />
              </button>
            </header>

            <div className="case-sheet__body">
              <div className="case-sheet__scan">
                <ScanBay
                  phase={phase}
                  activeStage={stage}
                  verdict={evaluation?.verdict.decision ?? null}
                  caseLabel={scenarioCode(selected.id)}
                  mode="demo"
                />
                <dl className="case-meta">
                  <div>
                    <dt>{tx('Amount', 'Jumlah')}</dt>
                    <dd className="mono">
                      {formatSuiAmount(selected.input.transfer.amountMist)} SUI
                    </dd>
                  </div>
                  <div>
                    <dt>{tx('Recipient', 'Penerima')}</dt>
                    <dd>
                      <Address value={selected.input.transfer.recipient} />
                    </dd>
                  </div>
                  <div>
                    <dt>{tx('Expected fixture verdict', 'Putusan fixture yang diharapkan')}</dt>
                    <dd>
                      <DecisionStamp decision={selected.expected.decision} size="sm" />
                    </dd>
                  </div>
                  <div>
                    <dt>{tx('Data source', 'Sumber data')}</dt>
                    <dd>{tx('Demo replay, deterministic engine', 'Replay demo, mesin deterministik')}</dd>
                  </div>
                </dl>
              </div>

              <div className="case-sheet__result">
                {phase === 'scanning' ? (
                  <div className="case-wait" aria-live="polite">
                    <span className="spinner" aria-hidden="true" />
                    <h3>{tx('The case is on the belt', 'Berkas ada di ban berjalan')}</h3>
                    <p>
                      {tx(
                        'The scanner reads the transfer, then Walrus Memory answers with your rules and address notes.',
                        'Pemindai membaca transfer, lalu Memori Walrus menjawab dengan aturan dan catatan alamatmu.',
                      )}
                    </p>
                  </div>
                ) : null}

                {phase === 'error' ? (
                  <div className="case-error" role="alert">
                    <Icon name="warning" size={22} />
                    <h3>{tx('The case did not reach a verdict', 'Berkas tidak mencapai putusan')}</h3>
                    <p>{errorText(caseError, lang)}</p>
                    <div className="case-error__actions">
                      <Button variant="secondary" size="sm" onClick={() => openCase(selected)}>
                        {tx('Run the scan again', 'Jalankan pemindaian lagi')}
                      </Button>
                      <Button variant="quiet" size="sm" onClick={closeCase}>
                        {tx('Close', 'Tutup')}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {phase === 'verdict' && evaluation ? (
                  <>
                    <section className={`case-slip case-slip--${caseTone(evaluation.verdict.decision)}`}>
                      <div className="case-slip__top">
                        <div>
                          <span className="mono case-slip__label">
                            {tx('Inspection slip', 'Slip pemeriksaan')}
                          </span>
                          <h3>{decisionCopy(evaluation.verdict.decision, lang).title}</h3>
                        </div>
                        <div className="case-slip__stamp">
                          <DecisionStamp decision={evaluation.verdict.decision} size="lg" />
                        </div>
                      </div>
                      <p className="case-slip__description">
                        {decisionCopy(evaluation.verdict.decision, lang).description}
                      </p>

                      <div className="case-slip__section">
                        <span className="mono case-slip__heading">
                          {tx('What fired', 'Yang menyala')}
                        </span>
                        <ul className="case-slip__findings">
                          {evaluation.verdict.findings.map((finding) => (
                            <li key={`${finding.rule}-${finding.message}`}>
                              <span className={`case-slip__rule case-slip__rule--${caseTone(finding.decision)} mono`}>
                                {finding.rule}
                              </span>
                              <div>
                                <strong>{ruleName(finding.rule, lang)}</strong>
                                <p>{findingText(finding, lang)}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="case-slip__section">
                        <span className="mono case-slip__heading">
                          {tx('Memory cited', 'Memori yang dikutip')}
                        </span>
                        {evaluation.verdict.usedMemories.length > 0 ? (
                          <ul className="case-slip__memories">
                            {evaluation.verdict.usedMemories.map((memory) => (
                              <li key={memory.id}>
                                <span className="mono">{cellCode(memory.id)}</span>
                                <p>
                                  {lang === 'en' ? memory.statementEn ?? memory.statement : memory.statement}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="case-slip__empty">
                            {tx(
                              'No stored memory was cited. Conservative defaults produced this verdict.',
                              'Tidak ada memori tersimpan yang dikutip. Batasan bawaan yang konservatif menghasilkan putusan ini.',
                            )}
                          </p>
                        )}
                      </div>

                      <div className="case-slip__foot">
                        <span className="mono">
                          {tx('Engine', 'Mesin')} {evaluation.verdict.decision}
                        </span>
                        <span className="mono">{formatDateTime(evaluation.createdAt, lang)}</span>
                      </div>
                    </section>

                    {recorded ? (
                      <div className="case-memory" role="status" aria-live="polite">
                        <span className="mono case-memory__code">
                          {cellCode(recorded.memory.memoryId)}
                        </span>
                        <div>
                          <strong>{tx('Decision saved to memory', 'Keputusan tersimpan di memori')}</strong>
                          <p>
                            {recorded.memory.status === 'written'
                              ? tx(
                                  'A Walrus blob was returned for this decision.',
                                  'Blob Walrus dikembalikan untuk keputusan ini.',
                                )
                              : recorded.memory.status === 'queued'
                                ? tx(
                                    'The write is queued on the server.',
                                    'Penulisan masuk antrean di server.',
                                  )
                                : tx(
                                    'The decision is saved, but the memory write failed.',
                                    'Keputusan tersimpan, tetapi penulisan memori gagal.',
                                  )}
                            {recorded.memory.blobId ? (
                              <> <span className="mono">{shortBlob(recorded.memory.blobId)}</span></>
                            ) : null}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openCase(selected)}
                          icon={<Icon name="refresh" size={15} />}
                        >
                          {tx('Check again', 'Periksa lagi')}
                        </Button>
                      </div>
                    ) : (
                      <div className="case-decision">
                        <div className="case-decision__head">
                          <div>
                            <span className="mono case-decision__label">
                              {tx('Your decision', 'Keputusanmu')}
                            </span>
                            <h3>{tx('Save what you choose.', 'Simpan yang kamu pilih.')}</h3>
                          </div>
                          <span className="case-decision__engine mono">
                            {tx('Engine', 'Mesin')} {evaluation.verdict.decision}
                          </span>
                        </div>
                        <label className="case-decision__remember">
                          <input
                            type="checkbox"
                            checked={rememberStance}
                            onChange={(event) => setRememberStance(event.target.checked)}
                          />
                          <span>
                            {tx(
                              'Also write the address stance to memory',
                              'Tulis juga sikap alamat ke memori',
                            )}
                            <small>
                              {tx(
                                'A reject writes a blocked address. A pass writes a trusted address. Hold writes only the decision.',
                                'Tolak menulis alamat diblokir. Lolos menulis alamat dipercaya. Tahan hanya menulis keputusan.',
                              )}
                            </small>
                          </span>
                        </label>
                        <div className="case-decision__buttons">
                          {(['LOLOS', 'TAHAN', 'TOLAK'] as const).map((decision) => (
                            <button
                              key={decision}
                              type="button"
                              className={`case-decision__button case-decision__button--${caseTone(decision)}`}
                              disabled={recording !== null}
                              onClick={() => void saveDecision(decision)}
                            >
                              <Icon
                                name={DECISION_COPY[decision].icon}
                                size={19}
                                strokeWidth={2.2}
                              />
                              <span>
                                {recording === decision
                                  ? tx('Saving...', 'Menyimpan...')
                                  : decisionCopy(decision, lang).label}
                              </span>
                            </button>
                          ))}
                        </div>
                        {recordError ? (
                          <p className="form-error" role="alert">
                            {errorText(recordError, lang)}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
