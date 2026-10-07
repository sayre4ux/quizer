import { useEffect, useMemo, useState } from 'react';
import { CHANGELOG } from '../changelog';
import { useActiveBank } from '../state/useStore';
import { entriesToShow, markSeen, readLastSeen } from '../lib/whatsNew';
import { Button, DialogOverlay } from './ui';

// Once per device per release: what changed since the version this device last saw.
export function WhatsNewDialog() {
  const ab = useActiveBank();
  const known = ab.status === 'ready' || ab.status === 'empty';
  const [lastSeen] = useState(readLastSeen);
  const [dismissed, setDismissed] = useState(false);
  const entries = useMemo(
    () => (known ? entriesToShow(CHANGELOG, __APP_VERSION__, lastSeen, ab.status === 'ready') : []),
    [known, lastSeen, ab.status],
  );

  // Nothing to show (fresh install, or already seen): just record the version.
  useEffect(() => {
    if (known && entries.length === 0) markSeen(__APP_VERSION__);
  }, [known, entries.length]);

  if (dismissed || entries.length === 0) return null;
  const close = () => {
    markSeen(__APP_VERSION__);
    setDismissed(true);
  };
  return (
    <DialogOverlay label="What's new" onClose={close}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Updated</div>
      <h2 className="mt-1 text-base font-semibold text-fg">What’s new in v{__APP_VERSION__}</h2>
      {entries.map((e) => (
        <div key={e.version} className="mt-3">
          {entries.length > 1 && <div className="tnum mb-1 text-xs font-medium text-muted">v{e.version}</div>}
          <ul className="flex flex-col gap-1.5">
            {e.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-snug text-fg/90">
                <span aria-hidden="true" className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-faint" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Button variant="primary" className="mt-5 min-h-11 w-full" onClick={close}>
        Got it
      </Button>
    </DialogOverlay>
  );
}
