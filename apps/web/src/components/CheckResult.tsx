import { useState, type ReactElement } from 'react';
import type { Decision } from '@kawal/rules';
import { useLang } from '../lib/i18n';
import { DECISION_COPY, EXPLORER, KIND_LABEL, decisionCopy } from '../lib/copy';
import { findingDetail, findingText, ruleName } from '../lib/findings';
import { errorText } from '../lib/errors';
import { formatDateTime, formatSuiAmount } from '../lib/format';
import type { DecisionRecord, Evaluation } from '../lib/api';
import { Address } from './Address';
import { Button } from './Button';
import { DecisionMark, DecisionStamp } from './DecisionStamp';
import { Icon } from './Icon';
import { PolicyMeter } from './PolicyMeter';

function warningText(code: string, lang: 'en' | 'id'): string {
  const map: Record<string, { en: string; id: string }> = {
    GAS_BUDGET_ESTIMATE: {
      en: 'Gas is a fixed budget for a simple SUI transfer, not a simulated gas result.',
      id: 'Gas adalah anggaran tetap untuk transfer SUI sederhana, bukan hasil simulasi gas.',
    },
    RISK_SOURCE_NOT_CONNECTED: {
      en: 'No risk source is connected in this build, so R7 stays quiet during live checks.',
      id: 'Belum ada sumber risiko di build ini, jadi R7 diam saat pemeriksaan live.',
    },
    BALANCE_UNAVAILABLE: {
      en: 'The balance could not be read. The transfer may still fail at signing.',
      id: 'Saldo tidak dapat dibaca. Transfer masih bisa gagal saat penandatanganan.',
    },
  };
  return map[code]?.[lang] ?? code;
}

function networkErrorText(code: string, lang: 'en' | 'id'): string {
  if (code.startsWith('BALANCE_')) {
    return lang === 'en' ? 'Balance read failed' : 'Pembacaan saldo gagal';
  }
  if (code === 'NOT_CONFIGURED') {
    return lang === 'en' ? 'Tatum not configured' : 'Tatum belum dikonfigurasi';
  }
  return lang === 'en' ? 'Network note' : 'Catatan jaringan';
}

function recordStatusText(status: DecisionRecord['memory']['status'], lang: 'en' | 'id'): string {
  if (status === 'written') return lang === 'en' ? 'Written to Walrus' : 'Tertulis ke Walrus';
  if (status === 'failed') return lang === 'en' ? 'Write failed' : 'Gagal menulis';
  return lang === 'en' ? 'Write queued' : 'Tulisan dalam antrean';
}

function toneFor(decision: Decision): 'pass' | 'hold' | 'block' {
  return DECISION_COPY[decision].tone;
}

export function CheckResult({
  evaluation,
  recorded,
  recording,
  recordError,
  onRecord,
  onRefreshRecord,
  onReset,
}: {
  evaluation: Evaluation;
  recorded: DecisionRecord | null;
  recording: boolean;
  recordError: unknown;
  onRecord: (stance?: 'trust' | 'deny') => void;
  onRefreshRecord: () => void;
  onReset: () => void;
}): ReactElement {
  const { tx, lang } = useLang();
  const [remember, setRemember] = useState(false);
  const decision = evaluation.verdict.decision;
  const copy = decisionCopy(decision, lang);
  const tone = toneFor(decision);
  const network = evaluation.network;
  const gas = evaluation.gas;
  const cited = evaluation.verdict.usedMemories;
  const stance = decision === 'TOLAK' ? 'deny' : 'trust';
  const stanceLabel =
    stance === 'deny'
      ? tx('Also remember this address as blocked', 'Ingat juga alamat ini sebagai diblokir')
      : tx('Also remember this address as trusted', 'Ingat juga alamat ini sebagai dipercaya');

  return (
    <section className="check-result" aria-live="polite" aria-label={tx('Check result', 'Hasil pemeriksaan')}>
      <div className={`result-verdict result-verdict--${tone} result-verdict--stamp`}>
        <DecisionMark decision={decision} />
        <div className="result-verdict__copy">
          <p className="result-verdict__eyebrow">
            {tx('Engine decision', 'Putusan mesin')} · {formatDateTime(evaluation.createdAt, lang)}
          </p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="result-verdict__amount">
          <span className="mono">{formatSuiAmount(evaluation.transfer.amountMist)} SUI</span>
          <span className="result-verdict__recipient">
            <Address value={evaluation.transfer.recipient} />
          </span>
        </div>
      </div>

      <div className="result-columns">
        <section className="result-block" aria-labelledby="findings-title">
          <div className="result-block__head">
            <h3 id="findings-title">{tx('What fired', 'Yang menyala')}</h3>
            <span className="mono result-block__count">
              {evaluation.verdict.triggered.join(' · ') || 'R9'}
            </span>
          </div>
          <ol className="finding-list">
            {evaluation.verdict.findings.map((finding) => {
              const detail = findingDetail(finding, lang);
              return (
                <li
                  key={`${finding.rule}-${finding.message}`}
                  className={`finding finding--${toneFor(finding.decision)}`}
                >
                  <span className="finding__rule mono">{finding.rule}</span>
                  <div className="finding__body">
                    <div className="finding__title">
                      <strong>{ruleName(finding.rule, lang)}</strong>
                      <DecisionStamp decision={finding.decision} size="sm" />
                    </div>
                    <p>{findingText(finding, lang)}</p>
                    {detail ? <code className="finding__detail mono">{detail}</code> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="result-block" aria-labelledby="evidence-title">
          <div className="result-block__head">
            <h3 id="evidence-title">{tx('Evidence', 'Bukti')}</h3>
            <span className="mono result-block__count">
              {evaluation.timing.totalMs} ms
            </span>
          </div>
          <dl className="evidence-list">
            <div>
              <dt>{tx('Network', 'Jaringan')}</dt>
              <dd>
                {network
                  ? `Tatum ${network.network === 'mainnet' ? 'Mainnet' : 'Testnet'}`
                  : tx('Not recorded', 'Belum tercatat')}
              </dd>
            </div>
            <div>
              <dt>{tx('Checkpoint', 'Checkpoint')}</dt>
              <dd>
                {network?.checkpoint ? (
                  <a
                    className="evidence-link mono"
                    href={EXPLORER[network.network].checkpoint(network.checkpoint)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {network.checkpoint}
                    <Icon name="external" size={13} />
                  </a>
                ) : (
                  tx('Unavailable', 'Tidak tersedia')
                )}
              </dd>
            </div>
            <div>
              <dt>{tx('Check latency', 'Latensi pemeriksaan')}</dt>
              <dd className="mono">{network ? `${network.latencyMs} ms` : '0 ms'}</dd>
            </div>
            <div>
              <dt>{tx('Gas budget', 'Anggaran gas')}</dt>
              <dd className="mono">{gas ? `${gas.budgetSui} SUI` : tx('Not recorded', 'Belum tercatat')}</dd>
            </div>
            <div>
              <dt>{tx('Balance at check', 'Saldo saat diperiksa')}</dt>
              <dd className="mono">
                {network?.balanceMist
                  ? `${formatSuiAmount(network.balanceMist)} SUI`
                  : tx('Unavailable', 'Tidak tersedia')}
              </dd>
            </div>
            <div>
              <dt>{tx('Recipient history', 'Riwayat penerima')}</dt>
              <dd>
                {evaluation.history.hasSentToRecipientBefore
                  ? tx('Recorded send found', 'Ada catatan pengiriman')
                  : tx('No recorded send', 'Belum ada catatan pengiriman')}
              </dd>
            </div>
            <div>
              <dt>{tx('Intent check', 'Pemeriksaan maksud')}</dt>
              <dd>
                {evaluation.simulation.status === 'success'
                  ? tx('Passed', 'Lolos')
                  : tx('Failed', 'Gagal')}
              </dd>
            </div>
            <div>
              <dt>{tx('Memory recalled', 'Memori terbaca')}</dt>
              <dd className="mono">{evaluation.memories.length}</dd>
            </div>
          </dl>

          {network && network.errors.length > 0 ? (
            <details className="network-notes">
              <summary>{tx('Network notes', 'Catatan jaringan')}</summary>
              <ul>
                {network.errors.map((code) => (
                  <li key={code}>
                    <span>{networkErrorText(code, lang)}</span>
                    <code className="mono">{code}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>

      <section className="result-block result-block--policy" aria-labelledby="policy-title">
        <div className="result-block__head">
          <h3 id="policy-title">{tx('Limits used', 'Batas yang dipakai')}</h3>
          <span className="mono result-block__count">
            {tx('Smallest remembered limit wins', 'Batas terkecil yang diingat menang')}
          </span>
        </div>
        <div className="policy-meters">
          <PolicyMeter
            thresholdKey="maxOutflow"
            threshold={evaluation.policy.thresholds.maxOutflow}
            amountSui={evaluation.simulation.totalOutflowSui}
          />
          <PolicyMeter
            thresholdKey="newRecipientMax"
            threshold={evaluation.policy.thresholds.newRecipientMax}
            amountSui={formatSuiAmount(evaluation.transfer.amountMist)}
            applicable={!evaluation.history.hasSentToRecipientBefore}
          />
          <PolicyMeter
            thresholdKey="trustedMax"
            threshold={evaluation.policy.thresholds.trustedMax}
            amountSui={formatSuiAmount(evaluation.transfer.amountMist)}
            applicable={evaluation.policy.trustList.some(
              (entry) => entry.address === evaluation.transfer.recipient,
            )}
          />
        </div>
        <p className="result-block__hint">
          {tx(
            'Each meter compares this transfer with the threshold the engine actually used. A memory cell code marks a limit that came from Walrus Memory.',
            'Setiap meter membandingkan transfer ini dengan batas yang benar-benar dipakai mesin. Kode sel memori menandai batas yang berasal dari Memori Walrus.',
          )}
        </p>
      </section>

      <div className="result-columns result-columns--lower">
        <section className="result-block" aria-labelledby="memory-title">
          <div className="result-block__head">
            <h3 id="memory-title">{tx('Memory used', 'Memori yang dipakai')}</h3>
            <span className="mono result-block__count">{cited.length}</span>
          </div>
          {cited.length > 0 ? (
            <ul className="memory-cites">
              {cited.map((memory) => (
                <li key={memory.id}>
                  <span className={`kind-tag kind-tag--${memory.kind}`}>
                    {KIND_LABEL[memory.kind][lang]}
                  </span>
                  <p>{lang === 'en' ? memory.statementEn ?? memory.statement : memory.statement}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="result-block__empty">
              {tx(
                'No stored memory was cited. The conservative defaults produced this result.',
                'Tidak ada memori tersimpan yang dikutip. Batasan bawaan yang konservatif menghasilkan putusan ini.',
              )}
            </p>
          )}
        </section>

        <section className="result-block" aria-labelledby="record-title">
          <div className="result-block__head">
            <h3 id="record-title">{tx('Record this decision', 'Catat putusan ini')}</h3>
            <span className="mono result-block__count">
              {evaluation.verdict.triggered.join(' · ') || 'R9'}
            </span>
          </div>

          {recorded ? (
            <div className={`record-state record-state--${recorded.memory.status}`} aria-live="polite">
              <Icon
                name={
                  recorded.memory.status === 'written'
                    ? 'check'
                    : recorded.memory.status === 'failed'
                      ? 'warning'
                      : 'clock'
                }
                size={20}
              />
              <div>
                <strong>{tx('Decision saved', 'Putusan tersimpan')}</strong>
                <p>
                  {recordStatusText(recorded.memory.status, lang)}
                  {recorded.memory.blobId ? (
                    <>
                      {' · '}
                      <span className="mono">{recorded.memory.blobId.slice(0, 12)}…</span>
                    </>
                  ) : null}
                </p>
                {recorded.memory.error ? (
                  <p className="record-state__error">{recorded.memory.error}</p>
                ) : null}
              </div>
              {recorded.memory.status === 'queued' ? (
                <Button variant="secondary" size="sm" onClick={onRefreshRecord}>
                  {tx('Refresh write', 'Muat ulang tulisan')}
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>{stanceLabel}</span>
              </label>
              <p className="result-block__hint">
                {tx(
                  'The engine verdict is saved as-is. The address note is optional and written to Walrus Memory.',
                  'Putusan mesin disimpan apa adanya. Catatan alamat bersifat opsional dan ditulis ke Memori Walrus.',
                )}
              </p>
              <Button
                variant="primary"
                icon={<Icon name="memory" size={18} />}
                onClick={() => onRecord(remember ? stance : undefined)}
                disabled={recording}
              >
                {recording
                  ? tx('Saving decision…', 'Menyimpan putusan…')
                  : copy.action}
              </Button>
              {recordError ? (
                <p className="form-error" role="alert">
                  {errorText(recordError, lang)}
                </p>
              ) : null}
            </>
          )}

          <div className="result-block__footer">
            <Button variant="quiet" onClick={onReset}>
              {tx('Check another transfer', 'Periksa transfer lain')}
            </Button>
          </div>
        </section>
      </div>

      <div className="result-warnings">
        {(evaluation.warnings ?? []).map((code) => (
          <p key={code} className="result-warning">
            <Icon name="info" size={15} />
            <span>{warningText(code, lang)}</span>
          </p>
        ))}
        {!evaluation.warnings?.length ? (
          <p className="result-warning">
            <Icon name="info" size={15} />
            <span>
              {tx(
                'This is an intent check. Kawal does not sign or send the transaction.',
                'Ini pemeriksaan maksud. Kawal tidak menandatangani atau mengirim transaksi.',
              )}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
