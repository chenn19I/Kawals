import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { safeNormalizeAddress, sui } from '@kawal/rules';
import { useLang } from '../lib/i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
  fetchDecision,
  recordDecision,
  runPreflight,
  type DecisionRecord,
  type Evaluation,
} from '../lib/api';
import { errorText } from '../lib/errors';
import { decisionCopy } from '../lib/copy';
import { Button } from '../components/Button';
import { CheckResult } from '../components/CheckResult';
import { LazyElephantMascot } from '../components/LazyElephantMascot';
import { Icon } from '../components/Icon';
import { TextField } from '../components/Field';

type FieldName = 'sender' | 'recipient' | 'amount';
type FieldCode = 'required' | 'invalid' | 'same' | 'positive';
type FieldErrors = Partial<Record<FieldName, FieldCode>>;

const SENDER_KEY = 'kawal.sender';

function readSender(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(SENDER_KEY) ?? '';
}

function fieldMessage(code: FieldCode, lang: 'en' | 'id'): string {
  if (code === 'required') return lang === 'en' ? 'This field is required.' : 'Kolom ini wajib diisi.';
  if (code === 'same') return lang === 'en' ? 'Recipient must differ from sender.' : 'Penerima harus berbeda dari pengirim.';
  if (code === 'positive') return lang === 'en' ? 'Amount must be greater than zero.' : 'Jumlah harus lebih besar dari nol.';
  return lang === 'en'
    ? 'Enter a valid Sui address or a SUI amount with up to 9 decimals.'
    : 'Masukkan alamat Sui yang sah atau jumlah SUI dengan maksimal 9 desimal.';
}

export function CheckScreen(): ReactElement {
  const { tx, lang } = useLang();
  const reducedMotion = usePrefersReducedMotion();
  const [sender, setSender] = useState(readSender);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<unknown>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<unknown>(null);
  const [recorded, setRecorded] = useState<DecisionRecord | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(SENDER_KEY, sender.trim());
  }, [sender]);

  useEffect(() => {
    if (!evaluation) return;
    resultRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [evaluation, reducedMotion]);

  const clearField = (name: FieldName): void => {
    setFields((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const validate = (): { sender: string; recipient: string; amountMist: bigint } | null => {
    const next: FieldErrors = {};
    const normalizedSender = safeNormalizeAddress(sender);
    const normalizedRecipient = safeNormalizeAddress(recipient);

    if (!sender.trim()) next.sender = 'required';
    else if (!normalizedSender) next.sender = 'invalid';

    if (!recipient.trim()) next.recipient = 'required';
    else if (!normalizedRecipient) next.recipient = 'invalid';

    let amountMist = 0n;
    if (!amount.trim()) {
      next.amount = 'required';
    } else {
      try {
        amountMist = sui(amount);
        if (amountMist <= 0n) next.amount = 'positive';
      } catch {
        next.amount = 'invalid';
      }
    }

    if (normalizedSender && normalizedRecipient && normalizedSender === normalizedRecipient) {
      next.recipient = 'same';
    }

    setFields(next);
    if (Object.keys(next).length > 0 || !normalizedSender || !normalizedRecipient) return null;
    return { sender: normalizedSender, recipient: normalizedRecipient, amountMist };
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (checking) return;
    const parsed = validate();
    if (!parsed) return;

    setChecking(true);
    setCheckError(null);
    setEvaluation(null);
    setRecorded(null);
    setRecordError(null);

    try {
      const next = await runPreflight({
        sender: parsed.sender,
        recipient: parsed.recipient,
        amountMist: parsed.amountMist.toString(),
      });
      setEvaluation(next);
    } catch (caught) {
      setCheckError(caught);
    } finally {
      setChecking(false);
    }
  };

  const saveDecision = async (stance?: 'trust' | 'deny'): Promise<void> => {
    if (!evaluation || recording || recorded) return;
    setRecording(true);
    setRecordError(null);
    try {
      const decision = await recordDecision({
        evaluationId: evaluation.id,
        decision: evaluation.verdict.decision,
        ...(stance ? { addressStance: stance } : {}),
      });
      setRecorded(decision);
    } catch (caught) {
      setRecordError(caught);
    } finally {
      setRecording(false);
    }
  };

  const refreshRecord = async (): Promise<void> => {
    if (!recorded) return;
    try {
      setRecorded(await fetchDecision(recorded.id));
    } catch (caught) {
      setRecordError(caught);
    }
  };

  const reset = (): void => {
    setEvaluation(null);
    setRecorded(null);
    setRecordError(null);
    setCheckError(null);
    setRecipient('');
    setAmount('');
    setFields({});
  };

  const decision = evaluation?.verdict.decision;
  const pose = checking
    ? 'scan'
    : decision === 'LOLOS'
      ? 'celebrate'
      : decision === 'TAHAN'
        ? 'scan'
        : 'idle';
  const elephantVerdict = decision
    ? decision === 'LOLOS'
      ? 'pass'
      : decision === 'TAHAN'
        ? 'hold'
        : 'reject'
    : undefined;
  const stageTitle = checking
    ? tx('Reading Tatum and Walrus', 'Membaca Tatum dan Walrus')
    : decision
      ? decisionCopy(decision, lang).title
      : tx('Waiting for a transfer', 'Menunggu transfer');
  const stageBody = checking
    ? tx(
        'One Tatum snapshot and one Walrus recall. The verdict comes from the rules engine.',
        'Satu snapshot Tatum dan satu pembacaan Walrus. Putusan datang dari mesin aturan.',
      )
    : decision
      ? decisionCopy(decision, lang).description
      : tx(
          'Fill the form with the same details your wallet will show. Nothing is signed here.',
          'Isi formulir dengan detail yang sama seperti di dompetmu. Tidak ada yang ditandatangani di sini.',
        );

  return (
    <div className="check-screen">
      <header className="page-intro">
        <p className="eyebrow">{tx('Checkpoint', 'Pos pemeriksaan')}</p>
        <h1>{tx('Check a transfer', 'Periksa transfer')}</h1>
        <p>
          {tx(
            'Kawal compares the transfer with your Walrus Memory and a live Tatum checkpoint. It returns one decision: pass, hold, or reject.',
            'Kawal membandingkan transfer dengan Memori Walrus dan checkpoint Tatum yang live. Hasilnya satu putusan: lolos, tahan, atau tolak.',
          )}
        </p>
      </header>

      <div className="check-layout">
        <form className="check-form panel" onSubmit={submit} noValidate aria-busy={checking}>
          <div className="panel__head">
            <div>
              <p className="eyebrow">{tx('Transfer intent', 'Maksud transfer')}</p>
              <h2>{tx('What are you about to sign?', 'Apa yang akan kamu tanda tangani?')}</h2>
            </div>
            <span className="mono panel__code">INTENT / 01</span>
          </div>

          <div className="check-form__fields">
            <TextField
              label={tx('Your Sui address', 'Alamat Sui kamu')}
              value={sender}
              onChange={(event) => {
                setSender(event.target.value);
                clearField('sender');
              }}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              mono
              hint={tx(
                'Only the public address. It stays in this browser.',
                'Hanya alamat publik. Alamat ini tersimpan di browser ini.',
              )}
              error={fields.sender ? fieldMessage(fields.sender, lang) : undefined}
            />

            <TextField
              label={tx('Recipient address', 'Alamat penerima')}
              value={recipient}
              onChange={(event) => {
                setRecipient(event.target.value);
                clearField('recipient');
              }}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              mono
              hint={tx(
                'Paste the full address from the wallet confirmation.',
                'Tempel alamat lengkap dari konfirmasi dompet.',
              )}
              error={fields.recipient ? fieldMessage(fields.recipient, lang) : undefined}
            />

            <TextField
              label={tx('Amount', 'Jumlah')}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                clearField('amount');
              }}
              placeholder="0.0"
              inputMode="decimal"
              autoComplete="off"
              suffix="SUI"
              hint={tx(
                'Before gas. Kawal adds a fixed gas budget on the server.',
                'Sebelum gas. Kawal menambahkan anggaran gas tetap di server.',
              )}
              error={fields.amount ? fieldMessage(fields.amount, lang) : undefined}
            />
          </div>

          <div className="check-form__actions">
            <Button
              type="submit"
              size="lg"
              variant="primary"
              icon={<Icon name="scan" size={18} />}
              disabled={checking}
            >
              {checking
                ? tx('Checking…', 'Memeriksa…')
                : tx('Check transfer', 'Periksa transfer')}
            </Button>
            <span className="check-form__note">
              {tx(
                'Reads a Tatum checkpoint and Walrus Memory. No signature.',
                'Membaca checkpoint Tatum dan Memori Walrus. Tanpa tanda tangan.',
              )}
            </span>
          </div>

          {checkError ? (
            <div className="form-error form-error--panel" role="alert">
              <Icon name="warning" size={18} />
              <div>
                <strong>{tx('Check did not run', 'Pemeriksaan tidak berjalan')}</strong>
                <p>{errorText(checkError, lang)}</p>
              </div>
            </div>
          ) : null}
        </form>

        <aside className={`check-stage mascot-stage ${checking ? 'is-scanning' : ''}`} aria-live="polite">
          <div className="mascot-stage__grid" aria-hidden="true" />
          <div className="mascot-stage__top">
            <span className="mono mascot-stage__code">CHECKPOINT / 02</span>
            <span className="mono mascot-stage__code">
              {checking ? tx('SCANNING', 'MEMINDAI') : tx('INTENT ONLY', 'HANYA MAKSUD')}
            </span>
          </div>
          <LazyElephantMascot
            pose={pose}
            verdict={elephantVerdict}
            scale={0.32}
            jumpHeight={decision === 'LOLOS' ? 0.45 : 0}
            label={tx('Kawal mascot checking the transfer', 'Maskot Kawal memeriksa transfer')}
          />
          <div className="check-stage__caption">
            <strong>{stageTitle}</strong>
            <p>{stageBody}</p>
            <div className="check-stage__rail" aria-hidden="true">
              <span className="is-complete" />
              <span className={checking ? 'is-active' : evaluation ? 'is-complete' : ''} />
              <span className={evaluation ? 'is-complete' : ''} />
            </div>
          </div>
        </aside>
      </div>

      {evaluation ? (
        <div ref={resultRef} className="check-result-wrap">
          <CheckResult
            evaluation={evaluation}
            recorded={recorded}
            recording={recording}
            recordError={recordError}
            onRecord={saveDecision}
            onRefreshRecord={refreshRecord}
            onReset={reset}
          />
        </div>
      ) : null}
    </div>
  );
}
