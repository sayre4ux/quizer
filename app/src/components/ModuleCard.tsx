import { useEffect, useState } from 'react';
import { getAssetURL } from '../lib/quizbank/idb';
import type { BankMeta } from '../lib/quizbank/idb';
import { GeneratedCover } from './GeneratedCover';

// Cover art for a module: provided image (from IDB) if present, else a generated
// monochrome cover. Square; the carousel sizes the wrapper.
export function CoverArt({ meta, className }: { meta: BankMeta; className?: string }) {
  const fallback = meta.module ?? meta.displayName;
  if (!meta.coverPath) return <GeneratedCover label={fallback} className={className} />;
  return <AssetCover key={meta.coverPath} assetKey={meta.coverPath} alt={meta.displayName} fallback={fallback} className={className} />;
}

function AssetCover({ assetKey, alt, fallback, className }: { assetKey: string; alt: string; fallback: string; className?: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void getAssetURL(assetKey).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [assetKey]);

  if (url === undefined) return <div className={className} style={{ background: 'var(--surface-2)' }} />; // loading
  if (url) return <img src={url} alt={alt} className={className} style={{ objectFit: 'cover' }} />;
  return <GeneratedCover label={fallback} className={className} />;
}

// The trailing "+ Add module" card art.
export function AddCoverArt({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        placeItems: 'center',
        border: '1.5px dashed color-mix(in oklab, var(--fg) 30%, transparent)',
        background: 'color-mix(in oklab, var(--surface-2) 92%, var(--fg))',
        color: 'var(--muted)',
      }}
    >
      <span
        className="grid place-items-center rounded-full"
        style={{ width: '30%', aspectRatio: '1', background: 'var(--surface)', boxShadow: 'var(--shadow-soft)' }}
      >
        <svg width="44%" height="44%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ width: '44%', height: '44%' }}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    </div>
  );
}
