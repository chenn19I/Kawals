import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { formatSui, safeNormalizeAddress, sui, type MemoryKind, type ThresholdKey } from '@kawal/rules';
import { useLang } from '../lib/i18n';
import {
  createMemory,
  fetchEvaluations,
  fetchMemories,
  forgetMemory,
  type EvaluationSummary,
  type MemoryCatalogEntry,
  type MemoryListResponse,
} from '../lib/api';
import { cellCode, cellReason, usageFromEvaluations } from '../lib/cells';
import { errorText } from '../lib/errors';
import { KIND_LABEL, THRESHOLD_LABEL } from '../lib/copy';
import { formatDateTime, formatRelative, formatSuiAmount, shortBlob } from '../lib/format';
import { Address } from '../components/Address';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { SelectField, TextField } from '../components/Field';

type Filter = MemoryKind | 'all';

const FILTERS: Array<{ key: Filter; en: string; id: string }> = [
  { key: 'all', en: 'All', id: 'Semua' },
  { key: 'aturan', en: 'Rules', id: 'Aturan' },
  { key: 'alamat', en: 'Addresses', id: 'Alamat' },
  { key: 'keputusan', en: 'Decisions', id: 'Keputusan' },
  { key: 'preferensi', en: 'Preferences', id: 'Preferensi' },
];

function statementFor(entry: MemoryCatalogEntry, lang: 'en' | 'id'): string {
  return lang === 'en' ? entry.record.statementEn ?? entry.record.statement : entry.record.statement;
}

function CreateMemoryForm({
  mode,
  onCreated,
  onCancel,
}: {
  mode: 'mock' | 'walrus';
  onCreated: (entry: MemoryCatalogEntry, blobId: string) => void;
  onCancel: () => void;
}): ReactElement {
  const { tx, lang } = useLang();
  const [kind, setKind] = useState<'aturan' | 'alamat'>('aturan');
  const [thresholdKey, setThresholdKey] = useState<ThresholdKey>('maxOutflow');
  const [amount, setAmount] = useState('5');
  const [address, setAddress] = useState('');
  const [stance, setStance] = useState<'trust' | 'deny'>('trust');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    let input;
    if (kind === 'aturan') {
      let mist: bigint;
      try {
        mist = sui(amount);
      } catch {
        setError(tx('Use a SUI amount with up to 9 decimals.', 'Gunakan jumlah SUI dengan maksimal 9 desimal.'));
        return;
      }
      if (mist <= 0n) {
        setError(tx('The limit must be greater than zero.', 'Batas harus lebih besar dari nol.'));
        return;
      }

      const display = formatSui(mist);
      const idStatement =
        thresholdKey === 'maxOutflow'
          ? `Aturan saya: tahan transfer dengan total keluar di atas ${display} SUI.`
          : thresholdKey === 'newRecipientMax'
            ? `Penerima baru hanya boleh menerima maksimal ${display} SUI.`
            : `Penerima yang saya percaya hanya boleh menerima di bawah ${display} SUI.`;
      const enStatement =
        thresholdKey === 'maxOutflow'
          ? `My rule: hold any transfer whose total outflow is above ${display} SUI.`
          : thresholdKey === 'newRecipientMax'
            ? `A new recipient may receive at most ${display} SUI.`
            : `I trust a recipient only below ${display} SUI.`;

      input = {
        kind: 'aturan' as const,
        statement: idStatement,
        statementEn: enStatement,
        threshold: { appliesTo: [thresholdKey], mist: mist.toString() },
      };
    } else {
      const normalized = safeNormalizeAddress(address);
      if (!normalized) {
        setError(tx('Enter a valid Sui address.', 'Masukkan alamat Sui yang sah.'));
        return;
      }
      input = {
        kind: 'alamat' as const,
        statement:
          stance === 'trust'
            ? `Saya mempercayai alamat ${normalized}.`
            : `Saya tidak mempercayai alamat ${normalized}.`,
        statementEn:
          stance === 'trust'
            ? `I trust the address ${normalized}.`
            : `I do not trust the address ${normalized}.`,
        address: normalized,
        stance,
      };
    }

    setSubmitting(true);
    try {
      const result = await createMemory(input);
      onCreated(result.memory, result.write.blobId);
    } catch (caught) {
      setError(errorText(caught, lang));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="create-memory panel" onSubmit={submit} noValidate>
      <div className="panel__head">
        <div>
          <p className="eyebrow">{tx('New memory', 'Memori baru')}</p>
          <h2>{tx('Write a rule Kawal can use', 'Tulis aturan yang bisa dipakai Kawal')}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label={tx('Close form', 'Tutup formulir')}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="segmented" role="group" aria-label={tx('Memory kind', 'Jenis memori')}>
        <button
          type="button"
          className={kind === 'aturan' ? 'is-active' : ''}
          aria-pressed={kind === 'aturan'}
          onClick={() => setKind('aturan')}
        >
          {tx('Spending rule', 'Aturan belanja')}
        </button>
        <button
          type="button"
          className={kind === 'alamat' ? 'is-active' : ''}
          aria-pressed={kind === 'alamat'}
          onClick={() => setKind('alamat')}
        >
          {tx('Address note', 'Catatan alamat')}
        </button>
      </div>

      {kind === 'aturan' ? (
        <div className="create-memory__fields">
          <SelectField
            label={tx('Applies to', 'Berlaku untuk')}
            value={thresholdKey}
            onChange={(event) => setThresholdKey(event.target.value as ThresholdKey)}
            hint={tx(
              'The engine uses the smallest remembered threshold when several rules overlap.',
              'Mesin memakai batas terkecil yang diingat bila beberapa aturan tumpang tindih.',
            )}
          >
            <option value="maxOutflow">{THRESHOLD_LABEL.maxOutflow[lang]}</option>
            <option value="newRecipientMax">{THRESHOLD_LABEL.newRecipientMax[lang]}</option>
            <option value="trustedMax">{THRESHOLD_LABEL.trustedMax[lang]}</option>
          </SelectField>
          <TextField
            label={tx('Limit', 'Batas')}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            suffix="SUI"
            hint={tx('Stored in MIST, so no decimal is rounded away.', 'Disimpan dalam MIST, jadi tidak ada desimal yang dibulatkan.')}
          />
        </div>
      ) : (
        <div className="create-memory__fields">
          <TextField
            label={tx('Sui address', 'Alamat Sui')}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            mono
            hint={tx('The full 32 byte address.', 'Alamat lengkap 32 byte.')}
          />
          <div className="field">
            <span className="field__label">{tx('Stance', 'Sikap')}</span>
            <div className="segmented" role="group" aria-label={tx('Address stance', 'Sikap alamat')}>
              <button
                type="button"
                className={stance === 'trust' ? 'is-active' : ''}
                aria-pressed={stance === 'trust'}
                onClick={() => setStance('trust')}
              >
                {tx('Trust', 'Percaya')}
              </button>
              <button
                type="button"
                className={stance === 'deny' ? 'is-active' : ''}
                aria-pressed={stance === 'deny'}
                onClick={() => setStance('deny')}
              >
                {tx('Block', 'Blokir')}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="create-memory__note">
        <Icon name="info" size={15} />
        <span>
          {mode === 'walrus'
            ? tx(
                'The API waits for a Walrus blob id before confirming this write.',
                'API menunggu blob id Walrus sebelum mengonfirmasi tulisan ini.',
              )
            : tx(
                'The API is in local memory mode. This write stays on the server, not in Walrus.',
                'API berada di mode memori lokal. Tulisan ini tersimpan di server, bukan di Walrus.',
              )}
        </span>
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="create-memory__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tx('Cancel', 'Batal')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          icon={<Icon name="memory" size={17} />}
          disabled={submitting}
        >
          {submitting
            ? tx('Writing…', 'Menulis…')
            : mode === 'walrus'
              ? tx('Write to Walrus', 'Tulis ke Walrus')
              : tx('Save to server', 'Simpan ke server')}
        </Button>
      </div>
    </form>
  );
}

export function MemoryScreen(): ReactElement {
  const { tx, lang } = useLang();
  const [data, setData] = useState<MemoryListResponse | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingForget, setPendingForget] = useState<MemoryCatalogEntry | null>(null);
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [forgetError, setForgetError] = useState<unknown>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);

    fetchMemories({ query: debounced, limit: 100 }, controller.signal)
      .then((next) => {
        if (alive) setData(next);
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
  }, [debounced, refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    fetchEvaluations(500, controller.signal)
      .then((next) => {
        if (alive) setEvaluations(next);
      })
      .catch(() => {
        if (alive) setEvaluations([]);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const forget = async (entry: MemoryCatalogEntry): Promise<void> => {
    if (forgetting) return;
    setForgetting(entry.record.id);
    setForgetError(null);
    try {
      await forgetMemory(entry.record.id);
      setPendingForget(null);
      setNotice(
        tx(
          'Memory removed from recall. The Walrus blob was not revoked.',
          'Memori dihapus dari pemanggilan. Blob Walrus tidak dicabut.',
        ),
      );
      setRefreshToken((value) => value + 1);
    } catch (caught) {
      setForgetError(caught);
    } finally {
      setForgetting(null);
    }
  };

  const memories = (data?.memories ?? []).filter(
    (entry) => filter === 'all' || entry.record.kind === filter,
  );
  const mode = data?.mode ?? 'mock';
  const isWalrus = mode === 'walrus';
  const usage = usageFromEvaluations(evaluations);

  return (
    <div className="memory-screen">
      <header className="page-intro page-intro--split">
        <div>
          <p className="eyebrow">{tx('Walrus Memory', 'Memori Walrus')}</p>
          <h1>{tx('Your rules, on the record.', 'Aturanmu, tercatat.')}</h1>
          <p>
            {tx(
              'Every check recalls rules and address notes from your memory namespace. Writes return a Walrus blob id when the namespace is live.',
              'Setiap pemeriksaan memanggil aturan dan catatan alamat dari namespace memorimu. Tulisan mengembalikan blob id Walrus saat namespace live.',
            )}
          </p>
        </div>
        <div className="page-intro__side">
          <span className={`mode-badge ${isWalrus ? 'is-live' : 'is-mock'}`}>
            <span className="mode-badge__dot" aria-hidden="true" />
            {isWalrus ? tx('Walrus live', 'Walrus live') : tx('Local mock', 'Mock lokal')}
          </span>
          <span className="page-intro__count mono">
            {data ? tx(`${data.count} memories`, `${data.count} memori`) : tx('Loading…', 'Memuat…')}
          </span>
        </div>
      </header>

      <div className={`mode-banner ${isWalrus ? 'mode-banner--live' : 'mode-banner--mock'}`}>
        <Icon name={isWalrus ? 'shield' : 'info'} size={18} />
        <p>
          {isWalrus
            ? tx(
                'Connected to Walrus. Reads and writes use the namespace configured on the API server.',
                'Terhubung ke Walrus. Baca dan tulis memakai namespace yang dikonfigurasi di server API.',
              )
            : tx(
                'Local memory mode. Nothing is written to Walrus. Set KAWAL_MEMORY_MODE=walrus on the API server to use your real namespace.',
                'Mode memori lokal. Tidak ada yang ditulis ke Walrus. Atur KAWAL_MEMORY_MODE=walrus di server API untuk memakai namespace nyata.',
              )}
        </p>
      </div>

      <details className="memory-manifest">
        <summary>
          <Icon name="memory" size={16} />
          <span>{tx('What is stored in a cell?', 'Apa yang tersimpan di satu sel?')}</span>
        </summary>
        <div>
          <p>
            {tx(
              'Each cell is one memory record. The printed cell code is derived from the record id, so forgetting one cell never renumbers the rest.',
              'Setiap sel adalah satu catatan memori. Kode sel dihitung dari id catatan, jadi melupakan satu sel tidak mengubah nomor sel lain.',
            )}
          </p>
          <ul>
            <li>{tx('Statement in Indonesian and English.', 'Pernyataan dalam bahasa Indonesia dan Inggris.')}</li>
            <li>{tx('Optional executable values: address stance or spending threshold.', 'Nilai yang bisa dijalankan: sikap alamat atau batas belanja.')}</li>
            <li>{tx('Source and Walrus blob id when the namespace is live.', 'Sumber dan blob id Walrus saat namespace live.')}</li>
            <li>{tx('Usage evidence from saved evaluations, never from estimates.', 'Bukti pemakaian dari evaluasi tersimpan, bukan perkiraan.')}</li>
          </ul>
        </div>
      </details>

      {notice ? (
        <div className="notice" role="status">
          <Icon name="check" size={17} />
          <p>{notice}</p>
          <button type="button" className="icon-button" onClick={() => setNotice(null)} aria-label={tx('Dismiss', 'Tutup')}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ) : null}

      <div className="memory-toolbar">
        <div className="memory-search">
          <TextField
            label={tx('Search memory', 'Cari memori')}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tx('Address, rule, decision…', 'Alamat, aturan, putusan…')}
            autoComplete="off"
          />
        </div>
        <Button
          variant="primary"
          icon={<Icon name="plus" size={17} />}
          onClick={() => setCreateOpen((value) => !value)}
        >
          {createOpen ? tx('Close form', 'Tutup formulir') : tx('New memory', 'Memori baru')}
        </Button>
      </div>

      {createOpen ? (
        <CreateMemoryForm
          mode={mode}
          onCancel={() => setCreateOpen(false)}
          onCreated={(entry, blobId) => {
            setCreateOpen(false);
            setNotice(
              tx(
                `Memory written. Blob ${shortBlob(blobId)}.`,
                `Memori tertulis. Blob ${shortBlob(blobId)}.`,
              ),
            );
            setData((current) =>
              current
                ? {
                    ...current,
                    count: current.count + 1,
                    memories: [entry, ...current.memories],
                  }
                : current,
            );
            setRefreshToken((value) => value + 1);
          }}
        />
      ) : null}

      <div className="filter-row" role="group" aria-label={tx('Filter memories', 'Saring memori')}>
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

      {error ? (
        <div className="state-block state-block--error" role="alert">
          <Icon name="warning" size={22} />
          <h2>{tx('Memory could not be read', 'Memori tidak dapat dibaca')}</h2>
          <p>{errorText(error, lang)}</p>
          <Button variant="secondary" onClick={() => setRefreshToken((value) => value + 1)}>
            {tx('Try again', 'Coba lagi')}
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="state-block" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{tx('Reading Walrus Memory…', 'Membaca Memori Walrus…')}</p>
        </div>
      ) : memories.length === 0 ? (
        <div className="state-block">
          <Icon name="memory" size={26} />
          <h2>{tx('No memory here yet', 'Belum ada memori di sini')}</h2>
          <p>
            {debounced
              ? tx(
                  'No stored memory matches that search. Try a shorter word.',
                  'Tidak ada memori tersimpan yang cocok dengan pencarian itu. Coba kata yang lebih pendek.',
                )
              : tx(
                  'Write a rule or an address note. Kawal will use it on the next check.',
                  'Tulis aturan atau catatan alamat. Kawal akan memakainya pada pemeriksaan berikutnya.',
                )}
          </p>
          {!debounced ? (
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              {tx('Write the first memory', 'Tulis memori pertama')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="memory-cells" aria-live="polite">
          {memories.map((entry) => {
            const threshold = entry.record.data?.threshold;
            const address = entry.record.data?.address;
            const used = usage.get(entry.record.id);
            return (
              <article className="memory-cell" key={entry.record.id}>
                <div className="memory-cell__top">
                  <span className="mono memory-cell__code">{cellCode(entry.record.id)}</span>
                  <span className={`kind-tag kind-tag--${entry.record.kind}`}>
                    {KIND_LABEL[entry.record.kind][lang]}
                  </span>
                  <span className={`memory-cell__source memory-cell__source--${entry.source}`}>
                    {entry.source === 'walrus'
                      ? tx('Walrus blob', 'Blob Walrus')
                      : tx('Server record', 'Catatan server')}
                  </span>
                </div>
                <p className="memory-cell__statement">{statementFor(entry, lang)}</p>
                <div className="memory-cell__meta">
                  {address ? (
                    <span>
                      {tx('Address', 'Alamat')} <Address value={address} />
                    </span>
                  ) : null}
                  {threshold ? (
                    <span>
                      {threshold.appliesTo
                        .map((key) => THRESHOLD_LABEL[key][lang])
                        .join(' / ')}{' '}
                      <strong className="mono">{formatSuiAmount(threshold.mist)} SUI</strong>
                    </span>
                  ) : null}
                  {entry.record.data?.stance ? (
                    <span>
                      {entry.record.data.stance === 'trust'
                        ? tx('Trusted', 'Dipercaya')
                        : tx('Blocked', 'Diblokir')}
                    </span>
                  ) : null}
                </div>

                <div className="memory-cell__usage">
                  <span className="memory-cell__usage-mark" aria-hidden="true">
                    <Icon name="scan" size={14} />
                  </span>
                  <div>
                    <strong>
                      {used
                        ? tx(
                            `Cited in ${used.count} ${used.count === 1 ? 'check' : 'checks'}`,
                            `Dikutip di ${used.count} pemeriksaan`,
                          )
                        : tx('Not cited yet', 'Belum pernah dikutip')}
                    </strong>
                    <span>
                      {used?.lastUsedAt
                        ? tx(
                            `Last used ${formatRelative(used.lastUsedAt, lang)}`,
                            `Terakhir dipakai ${formatRelative(used.lastUsedAt, lang)}`,
                          )
                        : cellReason(entry.record, lang)}
                    </span>
                  </div>
                </div>

                <div className="memory-cell__foot">
                  <span className="mono memory-cell__blob">{shortBlob(entry.blobId)}</span>
                  <span className="memory-cell__date">{formatDateTime(entry.createdAt, lang)}</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setForgetError(null);
                      setPendingForget(entry);
                    }}
                  >
                    <Icon name="trash" size={15} />
                    {tx('Forget', 'Lupakan')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {forgetError ? (
        <p className="form-error" role="alert">
          {errorText(forgetError, lang)}
        </p>
      ) : null}

      <p className="memory-footnote">
        {tx(
          'Forget is a local tombstone. Revoking the Walrus blob itself still needs the owner wallet.',
          'Lupakan adalah penanda lokal. Mencabut blob Walrus sendiri tetap membutuhkan dompet pemilik.',
        )}
      </p>

      <ConfirmDialog
        open={pendingForget !== null}
        title={tx('Forget this cell?', 'Lupakan sel ini?')}
        message={tx(
          'The cell is removed from recall. The Walrus blob stays on chain until the owner revokes it.',
          'Sel dihapus dari pemanggilan. Blob Walrus tetap di rantai sampai pemilik mencabutnya.',
        )}
        confirmLabel={
          forgetting
            ? tx('Forgetting...', 'Menghapus...')
            : tx('Forget cell', 'Lupakan sel')
        }
        destructive
        onCancel={() => setPendingForget(null)}
        onConfirm={() => {
          if (pendingForget) void forget(pendingForget);
        }}
      >
        {pendingForget ? (
          <div className="memory-forget-preview">
            <span className="mono">{cellCode(pendingForget.record.id)}</span>
            <p>{statementFor(pendingForget, lang)}</p>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
