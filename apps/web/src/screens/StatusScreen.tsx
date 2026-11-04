import { useEffect, useState, type ReactElement } from 'react';
import { DEFAULT_POLICY, formatSui } from '@kawal/rules';
import { useLang } from '../lib/i18n';
import { useHealth } from '../hooks/useHealth';
import {
  fetchDecisions,
  fetchNetwork,
  runSelfTest,
  type DecisionListItem,
  type NetworkEvidence,
  type SelfTestReport,
} from '../lib/api';
import { errorText } from '../lib/errors';
import { DECISION_COPY, EXPLORER, RULES } from '../lib/copy';
import { formatDateTime, formatSuiAmount, shortBlob, shortHash } from '../lib/format';
import { Address } from '../components/Address';
import { Button } from '../components/Button';
import { DecisionStamp } from '../components/DecisionStamp';
import { Icon } from '../components/Icon';

function statusOf(value: boolean | null, lang: 'en' | 'id'): string {
  if (value === null) return lang === 'en' ? 'Unknown' : 'Tidak diketahui';
  return value ? (lang === 'en' ? 'Online' : 'Online') : lang === 'en' ? 'Offline' : 'Offline';
}

function memoryStatusText(status: DecisionListItem['memory']['status'], lang: 'en' | 'id'): string {
  if (status === 'written') return lang === 'en' ? 'Walrus write done' : 'Tulisan Walrus selesai';
  if (status === 'failed') return lang === 'en' ? 'Walrus write failed' : 'Tulisan Walrus gagal';
  return lang === 'en' ? 'Walrus write queued' : 'Tulisan Walrus dalam antrean';
}

export function StatusScreen(): ReactElement {
  const { tx, lang } = useLang();
  const { health, error: healthError, loading: healthLoading, refresh: refreshHealth } = useHealth();
  const [network, setNetwork] = useState<NetworkEvidence | null>(null);
  const [networkError, setNetworkError] = useState<unknown>(null);
  const [networkToken, setNetworkToken] = useState(0);
  const [decisions, setDecisions] = useState<DecisionListItem[]>([]);
  const [decisionsError, setDecisionsError] = useState<unknown>(null);
  const [decisionsToken, setDecisionsToken] = useState(0);
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [testError, setTestError] = useState<unknown>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setNetworkError(null);
    fetchNetwork(undefined, controller.signal)
      .then((next) => {
        if (alive) setNetwork(next);
      })
      .catch((caught) => {
        if (!alive || (caught instanceof DOMException && caught.name === 'AbortError')) return;
        setNetworkError(caught);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [networkToken]);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setDecisionsError(null);
    fetchDecisions(20, controller.signal)
      .then((next) => {
        if (alive) setDecisions(next);
      })
      .catch((caught) => {
        if (!alive || (caught instanceof DOMException && caught.name === 'AbortError')) return;
        setDecisionsError(caught);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [decisionsToken]);

  const refreshAll = (): void => {
    refreshHealth();
    setNetworkToken((value) => value + 1);
    setDecisionsToken((value) => value + 1);
  };

  const test = async (): Promise<void> => {
    if (testing) return;
    setTesting(true);
    setTestError(null);
    try {
      setReport(await runSelfTest());
    } catch (caught) {
      setTestError(caught);
    } finally {
      setTesting(false);
    }
  };

  const online = health ? health.status === 'ok' : null;
  const guardActive = health ? health.guard === 'active' : null;
  const tatumNetwork = network?.network ?? health?.tatum ?? null;
  const checkpoint = network?.checkpoint ?? null;
  const checkpointHref =
    checkpoint && tatumNetwork
      ? EXPLORER[tatumNetwork].checkpoint(checkpoint)
      : null;
  const failures = report ? report.total - report.passedCount : 0;

  return (
    <div className="status-screen">
      <header className="page-intro page-intro--split">
        <div>
          <p className="eyebrow">{tx('Guard status', 'Status penjaga')}</p>
          <h1>{tx('What the guard can see.', 'Apa yang bisa dilihat penjaga.')}</h1>
          <p>
            {tx(
              'API health, Tatum evidence, the twelve self-test scenarios, and the decisions recorded on this server.',
              'Kesehatan API, bukti Tatum, dua belas skenario uji mandiri, dan putusan yang tercatat di server ini.',
            )}
          </p>
        </div>
        <div className="page-intro__side">
          <Button
            variant="secondary"
            icon={<Icon name="refresh" size={16} />}
            onClick={refreshAll}
            disabled={healthLoading}
          >
            {tx('Refresh all', 'Muat ulang semua')}
          </Button>
        </div>
      </header>

      {healthError ? (
        <div className="state-block state-block--error" role="alert">
          <Icon name="warning" size={22} />
          <h2>{tx('The guard API is offline', 'API penjaga offline')}</h2>
          <p>{errorText(healthError, lang)}</p>
          <Button variant="secondary" onClick={refreshAll}>
            {tx('Try again', 'Coba lagi')}
          </Button>
        </div>
      ) : null}

      <section className="status-grid" aria-label={tx('Guard summary', 'Ringkasan penjaga')}>
        <article className="status-card">
          <span className="status-card__label">{tx('Guard', 'Penjaga')}</span>
          <strong className={`status-card__value ${guardActive === false ? 'is-bad' : ''}`}>
            <span className={`status-mark ${guardActive ? 'is-live' : 'is-offline'}`}>
              <span className="status-mark__dot" aria-hidden="true" />
              {guardActive === null
                ? tx('Unknown', 'Tidak diketahui')
                : guardActive
                  ? tx('Active', 'Aktif')
                  : tx('Revoked', 'Dicabut')}
            </span>
          </strong>
          <small>{health ? `v${health.version}` : tx('No response', 'Tidak ada jawaban')}</small>
        </article>
        <article className="status-card">
          <span className="status-card__label">{tx('API', 'API')}</span>
          <strong className="status-card__value">
            <span className={`status-mark ${online ? 'is-live' : 'is-offline'}`}>
              <span className="status-mark__dot" aria-hidden="true" />
              {statusOf(online, lang)}
            </span>
          </strong>
          <small>{health ? health.service : tx('Not connected', 'Belum terhubung')}</small>
        </article>
        <article className="status-card">
          <span className="status-card__label">{tx('Memory', 'Memori')}</span>
          <strong className="status-card__value">
            {health?.memory === 'walrus' ? 'Walrus' : tx('Local mock', 'Mock lokal')}
          </strong>
          <small>
            {health?.memory === 'walrus'
              ? tx('Live namespace', 'Namespace live')
              : tx('No blob write', 'Tanpa tulisan blob')}
          </small>
        </article>
        <article className="status-card">
          <span className="status-card__label">{tx('Network', 'Jaringan')}</span>
          <strong className="status-card__value">
            {tatumNetwork ? (tatumNetwork === 'mainnet' ? 'Mainnet' : 'Testnet') : tx('Not configured', 'Belum dikonfigurasi')}
          </strong>
          <small>{checkpoint ? `#${checkpoint}` : tx('No checkpoint', 'Tanpa checkpoint')}</small>
        </article>
      </section>

      <div className="status-columns">
        <section className="status-panel panel" aria-labelledby="network-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">{tx('Tatum evidence', 'Bukti Tatum')}</p>
              <h2 id="network-title">{tx('Live network read', 'Bacaan jaringan live')}</h2>
            </div>
            <Button
              variant="quiet"
              size="sm"
              icon={<Icon name="refresh" size={15} />}
              onClick={() => setNetworkToken((value) => value + 1)}
            >
              {tx('Refresh', 'Muat ulang')}
            </Button>
          </div>

          {networkError ? (
            <p className="form-error" role="alert">
              {errorText(networkError, lang)}
            </p>
          ) : !network ? (
            <p className="status-panel__loading">
              <span className="spinner" aria-hidden="true" />
              {tx('Reading Tatum…', 'Membaca Tatum…')}
            </p>
          ) : (
            <>
              <dl className="detail-list">
                <div>
                  <dt>{tx('Checkpoint', 'Checkpoint')}</dt>
                  <dd>
                    {checkpointHref ? (
                      <a className="evidence-link mono" href={checkpointHref} target="_blank" rel="noreferrer">
                        {checkpoint}
                        <Icon name="external" size={13} />
                      </a>
                    ) : (
                      tx('Not available', 'Tidak tersedia')
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tx('Digest', 'Digest')}</dt>
                  <dd className="mono">
                    {network.checkpointDigest ? shortHash(network.checkpointDigest) : tx('Not available', 'Tidak tersedia')}
                  </dd>
                </div>
                <div>
                  <dt>{tx('Chain identifier', 'Identifier rantai')}</dt>
                  <dd className="mono">
                    {network.chainIdentifier ? shortHash(network.chainIdentifier) : tx('Not available', 'Tidak tersedia')}
                  </dd>
                </div>
                <div>
                  <dt>{tx('Reference gas price', 'Harga gas referensi')}</dt>
                  <dd className="mono">
                    {network.referenceGasPriceMist
                      ? `${network.referenceGasPriceMist} MIST`
                      : tx('Not available', 'Tidak tersedia')}
                  </dd>
                </div>
                <div>
                  <dt>{tx('Latency', 'Latensi')}</dt>
                  <dd className="mono">{network.latencyMs} ms</dd>
                </div>
                <div>
                  <dt>{tx('Source', 'Sumber')}</dt>
                  <dd>
                    {network.configured
                      ? `${network.endpoint ?? 'Tatum'}${network.cached ? tx(' · cached', ' · cache') : ''}`
                      : tx('Tatum is not configured on the API server.', 'Tatum belum dikonfigurasi di server API.')}
                  </dd>
                </div>
              </dl>
              {network.errors.length > 0 ? (
                <div className="code-list">
                  <span>{tx('Network notes', 'Catatan jaringan')}</span>
                  <ul>
                    {network.errors.map((code) => (
                      <li key={code} className="mono">
                        {code}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="status-panel panel" aria-labelledby="limits-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">{tx('Conservative defaults', 'Bawaan konservatif')}</p>
              <h2 id="limits-title">{tx('When memory is silent', 'Saat memori diam')}</h2>
            </div>
          </div>
          <dl className="limit-list">
            <div>
              <dt>{tx('Maximum outflow', 'Maksimum keluar')}</dt>
              <dd className="mono">{formatSui(DEFAULT_POLICY.maxOutflow.mist)} SUI</dd>
            </div>
            <div>
              <dt>{tx('New recipient', 'Penerima baru')}</dt>
              <dd className="mono">{formatSui(DEFAULT_POLICY.newRecipientMax.mist)} SUI</dd>
            </div>
            <div>
              <dt>{tx('Trusted recipient', 'Penerima dipercaya')}</dt>
              <dd className="mono">{formatSui(DEFAULT_POLICY.trustedMax.mist)} SUI</dd>
            </div>
          </dl>
          <p className="status-panel__note">
            {tx(
              'Memory thresholds replace these values. When several rules overlap, the smallest remembered threshold wins.',
              'Batas dari memori menggantikan nilai ini. Bila beberapa aturan tumpang tindih, batas terkecil yang diingat menang.',
            )}
          </p>
        </section>
      </div>

      <section className="status-panel panel" aria-labelledby="selftest-title">
        <div className="panel__head">
          <div>
            <p className="eyebrow">{tx('Self-test', 'Uji mandiri')}</p>
            <h2 id="selftest-title">{tx('Twelve scenarios, one engine', 'Dua belas skenario, satu mesin')}</h2>
          </div>
          <Button
            variant="secondary"
            icon={<Icon name="play" size={16} />}
            onClick={() => void test()}
            disabled={testing}
          >
            {testing ? tx('Running…', 'Menjalankan…') : tx('Run self-test', 'Jalankan uji mandiri')}
          </Button>
        </div>

        <p className="status-panel__note">
          {tx(
            'The self-test replays the twelve Pasar Tiruan fixtures through the same rules engine used by live checks. No network or memory write is involved.',
            'Uji mandiri memutar ulang dua belas fixture Pasar Tiruan lewat mesin aturan yang sama dengan pemeriksaan live. Tidak ada jaringan atau tulisan memori yang terlibat.',
          )}
        </p>

        {testError ? (
          <p className="form-error" role="alert">
            {errorText(testError, lang)}
          </p>
        ) : null}

        {report ? (
          <div className="selftest" aria-live="polite">
            <div className={`selftest__summary ${report.passed ? 'is-pass' : 'is-fail'}`}>
              <Icon name={report.passed ? 'check' : 'warning'} size={20} />
              <strong>
                {report.passed
                  ? tx(`${report.passedCount} of ${report.total} scenarios passed`, `${report.passedCount} dari ${report.total} skenario lolos`)
                  : tx(`${failures} scenarios failed`, `${failures} skenario gagal`)}
              </strong>
              <span className="mono">{formatDateTime(report.ranAt, lang)}</span>
            </div>
            <ul className="selftest__list">
              {report.results.map((result) => (
                <li key={result.id} className={result.ok ? 'is-pass' : 'is-fail'}>
                  <span className={`selftest__mark ${result.ok ? 'is-pass' : 'is-fail'}`}>
                    <Icon name={result.ok ? 'check' : 'x'} size={14} />
                  </span>
                  <span className="selftest__title">{lang === 'en' ? result.titleEn : result.title}</span>
                  <span className="selftest__rules mono">
                    {result.expectedRules.join(' · ') || 'none'}
                  </span>
                  <span className="selftest__decisions">
                    <DecisionStamp decision={result.actual} size="sm" />
                    {!result.ok ? <DecisionStamp decision={result.expected} size="sm" /> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="status-columns">
        <section className="status-panel panel" aria-labelledby="decisions-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">{tx('Recorded decisions', 'Putusan tercatat')}</p>
              <h2 id="decisions-title">{tx('Local decision history', 'Riwayat putusan lokal')}</h2>
            </div>
            <Button
              variant="quiet"
              size="sm"
              icon={<Icon name="refresh" size={15} />}
              onClick={() => setDecisionsToken((value) => value + 1)}
            >
              {tx('Refresh', 'Muat ulang')}
            </Button>
          </div>

          {decisionsError ? (
            <p className="form-error" role="alert">
              {errorText(decisionsError, lang)}
            </p>
          ) : decisions.length === 0 ? (
            <div className="status-panel__empty">
              <Icon name="clock" size={22} />
              <p>
                {tx(
                  'No decision has been recorded on this server. Run a check and save its result.',
                  'Belum ada putusan yang tercatat di server ini. Jalankan pemeriksaan lalu simpan hasilnya.',
                )}
              </p>
            </div>
          ) : (
            <ul className="decision-list">
              {decisions.map((decision) => (
                <li key={decision.id}>
                  <div className="decision-list__top">
                    <DecisionStamp decision={decision.decision} size="sm" />
                    <span className="mono">{formatDateTime(decision.createdAt, lang)}</span>
                  </div>
                  <div className="decision-list__body">
                    <span className="mono">{formatSuiAmount(decision.transfer.amountMist)} SUI</span>
                    {decision.transfer.recipient ? (
                      <Address value={decision.transfer.recipient} />
                    ) : (
                      <span>{tx('Recipient not recorded', 'Penerima tidak tercatat')}</span>
                    )}
                  </div>
                  <div className="decision-list__meta">
                    <span>{memoryStatusText(decision.memory.status, lang)}</span>
                    {decision.memory.blobId ? (
                      <span className="mono">{shortBlob(decision.memory.blobId)}</span>
                    ) : null}
                    <span>
                      {tx('Engine', 'Mesin')}:{' '}
                      {DECISION_COPY[decision.engineDecision][lang].label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="status-panel panel" aria-labelledby="rules-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">{tx('Rulebook', 'Buku aturan')}</p>
              <h2 id="rules-title">{tx('R1 to R9', 'R1 sampai R9')}</h2>
            </div>
          </div>
          <ul className="rules-list">
            {RULES.map((rule) => (
              <li key={rule.id}>
                <span className="rules-list__id mono">{rule.id}</span>
                <div>
                  <div className="rules-list__top">
                    <strong>{rule.name[lang]}</strong>
                    <DecisionStamp decision={rule.decision} size="sm" />
                  </div>
                  <p>{rule.body[lang]}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="status-panel__note">
            {tx(
              'R8 and R9 only apply when no rule from R1 to R7 fires. R7 stays inactive until a risk source is connected.',
              'R8 dan R9 hanya berlaku bila tidak ada aturan R1 sampai R7 yang menyala. R7 tetap tidak aktif sampai sumber risiko terhubung.',
            )}
          </p>
        </section>
      </div>

      <p className="status-footnote">
        {tx(
          'This build checks a transfer intent. It does not simulate a full transaction, intercept a wallet, or sign anything. Live balance reads can be rate limited by Tatum; a missing balance is shown as a warning, never as a pass.',
          'Build ini memeriksa maksud transfer. Build ini tidak menyimulasikan transaksi penuh, mencegat dompet, atau menandatangani apa pun. Pembacaan saldo live bisa dibatasi Tatum; saldo yang hilang ditampilkan sebagai peringatan, bukan lolos.',
        )}
      </p>
    </div>
  );
}
