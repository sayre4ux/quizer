import { useEffect, useState } from 'react';
import { getAssetURL } from '../lib/quizbank/idb';

// Resolves an IDB asset key to an object URL (cached per bank, revoked centrally
// on bank switch/remove). null until resolved or if absent.
export function useAssetURL(assetKey: string): string | null {
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    void getAssetURL(assetKey).then((url) => { if (alive) setResolved({ key: assetKey, url }); });
    return () => { alive = false; };
  }, [assetKey]);
  // Ignore a URL resolved for a previous key while the new one loads.
  return resolved?.key === assetKey ? resolved.url : null;
}
