import { useEffect, useState, type ReactElement } from 'react';
import { useLang } from '../lib/i18n';
import { useHealth } from '../hooks/useHealth';
import { fetchNetwork, type NetworkEvidence } from '../lib/api';
import type { Screen } from '../state/useHashScreen';
import { Button } from '../components/Button';
import { LazyElephantMascot } from '../components/LazyElephantMascot';
import { Icon } from '../components/Icon';
import { GuidedDemo } from '../components/GuidedDemo';

const STEPS = [
  {
    en: {
      title: 'Write the intent',
      body: 'Enter the recipient and amount exactly as your wallet shows them. Kawal checks the transfer before you sign.',
    },
    id: {
      title: 'Tulis maksud transfer',
      body: 'Masukkan penerima dan jumlah persis seperti yang tampil di dompetmu. Kawal memeriksa sebelum kamu menandatangani.',
    },
    icon: 'scan' as const,
  },
  {
    en: {
      title: 'Read your memory',
      body: 'Walrus Memory returns your rules, address notes, and past decisions. The smallest remembered limit wins.',
    },
    id: {
      title: 'Baca memori',
      body: 'Memori Walrus mengembalikan aturan, catatan alamat, dan putusan lamamu. Batas terkecil yang diingat selalu menang.',
    },
    icon: 'memory' as const,
  },
  {
    en: {
      title: 'Check the network',
      body: 'Tatum supplies a live Sui checkpoint, gas price, and balance when available. Missing network data is never guessed around.',
    },
    id: {
      title: 'Periksa jaringan',
      body: 'Tatum memberi checkpoint Sui, harga gas, dan saldo bila tersedia. Data jaringan yang hilang tidak pernah ditebak.',
    },
    icon: 'shield' as const,
  },
] as const;

export function HomeScreen({ navigate }: { navigate: (screen: Screen) => void }): ReactElement {
  const { tx, lang } = useLang();
  const { health, error } = useHealth();
  const [network, setNetwork] = useState<NetworkEvidence | null>(null);
  const [guidedOpen, setGuidedOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchNetwork(undefined, controller.signal)
      .then((next) => setNetwork(next))
      .catch(() => setNetwork(null));
    return () => controller.abort();
  }, []);

  const online = Boolean(health) && !error;
  const checkpoint = network?.checkpoint ?? null;
  const checkpointHref =
    checkpoint && network
      ? `https://suiscan.xyz/${network.network}/checkpoint/${checkpoint}`
      : null;
  const memoryLabel = !health
    ? tx('Unknown', 'Tidak diketahui')
    : health.memory === 'walrus'
      ? tx('Walrus', 'Walrus')
      : tx('Local mock', 'Mock lokal');

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">{tx('Sui transaction checkpoint', 'Pos pemeriksaan transaksi Sui')}</p>
          <h1>
            {tx('Check first.', 'Periksa dulu.')}
            <br />
            <span>{tx('Sign later.', 'Tanda tangan kemudian.')}</span>
          </h1>
          <p className="home-hero__lede">
            {tx(
              'Kawal reads the transfer, recalls your own rules from Walrus, and checks the live Sui network through Tatum. If something does not fit, it holds before your wallet signs.',
              'Kawal membaca transfer, memanggil aturanmu dari Walrus, dan memeriksa jaringan Sui lewat Tatum. Bila ada yang tidak cocok, Kawal menahan sebelum dompetmu menandatangani.',
            )}
          </p>
          <div className="home-hero__actions">
            <Button
              size="lg"
              variant="primary"
              iconAfter={<Icon name="arrow-right" size={18} />}
              onClick={() => navigate('check')}
            >
              {tx('Check a transfer', 'Periksa transfer')}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('memory')}>
              {tx('Open Walrus Memory', 'Buka Memori Walrus')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              iconAfter={<Icon name="play" size={18} />}
              onClick={() => setGuidedOpen(true)}
            >
              {tx('Guided demo', 'Demo terpandu')}
            </Button>
          </div>
          <p className="home-hero__note">
            <Icon name="lock" size={15} />
            <span>
              {tx(
                'No keys in the browser. No signing. You still approve in your wallet.',
                'Tidak ada kunci di browser. Tidak ada tanda tangan. Kamu tetap menyetujui di dompetmu.',
              )}
            </span>
          </p>
        </div>

        <div className="mascot-stage mascot-stage--hero">
          <div className="mascot-stage__grid" aria-hidden="true" />
          <div className="mascot-stage__top">
            <span className={`live-tag ${online ? 'is-live' : 'is-offline'}`}>
              <span className="live-tag__dot" aria-hidden="true" />
              {online ? tx('Guard on duty', 'Penjaga bertugas') : tx('API offline', 'API offline')}
            </span>
            <span className="mono mascot-stage__code">R1-R9</span>
          </div>
          <LazyElephantMascot
            pose="scan"
            verdict="hold"
            scale={0.34}
            label={tx(
              'Voxel detective elephant scanning a transaction with a magnifying glass',
              'Gajah detektif voxel memindai transaksi dengan kaca pembesar',
            )}
          />
          <div className="mascot-stage__caption">
            <div>
              <strong>Kawal</strong>
              <span>{tx('Transaction detective', 'Detektif transaksi')}</span>
            </div>
            <p>
              {tx(
                'Reads the intent. Keeps the receipt.',
                'Membaca maksud. Menyimpan bukti.',
              )}
            </p>
          </div>
        </div>
      </section>

      <GuidedDemo
        open={guidedOpen}
        onClose={() => setGuidedOpen(false)}
        navigate={navigate}
      />

      <section className="home-steps" aria-labelledby="how-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{tx('The checkpoint', 'Pos pemeriksaan')}</p>
            <h2 className="section-heading__title" id="how-title">
              {tx('Three reads before a signature.', 'Tiga bacaan sebelum tanda tangan.')}
            </h2>
          </div>
          <p className="section-heading__aside">
            {tx(
              'The rules engine is deterministic. The same input always produces the same decision, and the explanation cannot overwrite it.',
              'Mesin aturan bersifat deterministik. Input yang sama selalu menghasilkan putusan yang sama, dan penjelasan tidak bisa menimpanya.',
            )}
          </p>
        </div>

        <ol className="step-grid">
          {STEPS.map((step, index) => (
            <li className="step-card" key={step.en.title}>
              <div className="step-card__top">
                <span className="step-card__index mono">{String(index + 1).padStart(2, '0')}</span>
                <Icon name={step.icon} size={22} />
              </div>
              <h3>{lang === 'en' ? step.en.title : step.id.title}</h3>
              <p>{lang === 'en' ? step.en.body : step.id.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="evidence-band" aria-labelledby="evidence-title">
        <div className="evidence-band__head">
          <p className="eyebrow">{tx('Live from this machine', 'Live dari mesin ini')}</p>
          <h2 id="evidence-title">{tx('Not a mock result.', 'Bukan hasil tiruan.')}</h2>
          <p>
            {tx(
              'These values come from the API server that will run your check. A missing checkpoint stops the check instead of passing it.',
              'Nilai ini datang dari server API yang akan menjalankan pemeriksaanmu. Checkpoint yang hilang menghentikan pemeriksaan, bukan meloloskannya.',
            )}
          </p>
        </div>

        <dl className="evidence-grid">
          <div className="evidence-cell">
            <dt>{tx('Guard API', 'API penjaga')}</dt>
            <dd>
              <span className={`status-mark ${online ? 'is-live' : 'is-offline'}`}>
                <span className="status-mark__dot" aria-hidden="true" />
                {online ? tx('Online', 'Online') : tx('Offline', 'Offline')}
              </span>
            </dd>
            <small>{health ? `v${health.version}` : tx('No response', 'Tidak ada jawaban')}</small>
          </div>
          <div className="evidence-cell">
            <dt>{tx('Tatum checkpoint', 'Checkpoint Tatum')}</dt>
            <dd className="mono">
              {checkpointHref ? (
                <a href={checkpointHref} target="_blank" rel="noreferrer">
                  #{checkpoint}
                  <Icon name="external" size={13} />
                </a>
              ) : (
                tx('Unavailable', 'Tidak tersedia')
              )}
            </dd>
            <small>
              {network
                ? `${network.network === 'mainnet' ? 'Mainnet' : 'Testnet'} · ${network.latencyMs} ms`
                : tx('Not configured', 'Belum dikonfigurasi')}
            </small>
          </div>
          <div className="evidence-cell">
            <dt>{tx('Memory source', 'Sumber memori')}</dt>
            <dd>{memoryLabel}</dd>
            <small>
              {health?.memory === 'walrus'
                ? tx('Real Walrus namespace', 'Namespace Walrus nyata')
                : tx('Set KAWAL_MEMORY_MODE=walrus', 'Atur KAWAL_MEMORY_MODE=walrus')}
            </small>
          </div>
        </dl>

        <div className="evidence-band__foot">
          <span>
            {tx(
              'Rules R1 to R9. Heaviest decision wins.',
              'Aturan R1 sampai R9. Putusan terberat menang.',
            )}
          </span>
          <Button variant="quiet" iconAfter={<Icon name="arrow-right" size={16} />} onClick={() => navigate('status')}>
            {tx('Open guard status', 'Buka status penjaga')}
          </Button>
        </div>
      </section>
    </div>
  );
}
