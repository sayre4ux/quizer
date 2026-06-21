import { useEffect, useState } from 'react';
import { getAssetURL } from '../lib/quizbank/idb';

// Resolves an IDB asset key to an object URL (cached per bank, revoked centrally
// on bank switch/remove). Renders nothing until resolved or if absent.
export function AssetImage({ assetKey, alt, className }: { assetKey: string; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getAssetURL(assetKey).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [assetKey]);
  if (!url) return null;
  return <img src={url} alt={alt ?? ''} className={className} loading="lazy" />;
}
