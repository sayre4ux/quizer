import { useState } from 'react';
import { useAssetURL } from './useAssetURL';
import { DialogOverlay } from './ui';
import { cx, stopEnterSpace } from './ui-utils';

// Renders an IDB asset image. Renders nothing until resolved or if absent.
export function AssetImage({ assetKey, alt, className }: { assetKey: string; alt?: string; className?: string }) {
  const url = useAssetURL(assetKey);
  if (!url) return null;
  return <img src={url} alt={alt ?? ''} className={className} loading="lazy" />;
}

// A figure thumbnail that opens the full-size image in a dialog. The button is
// only rendered once the image resolves, so there is never an empty tab stop.
export function ZoomableImage({ assetKey, className }: { assetKey: string; className?: string }) {
  const url = useAssetURL(assetKey);
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Enlarge figure"
        onClick={() => setOpen(true)}
        onKeyDown={stopEnterSpace}
        className="block max-w-full cursor-zoom-in self-start rounded-xl"
      >
        <img src={url} alt="" className={className} loading="lazy" />
      </button>
      {open && <ImageDialog url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

// Icon-only enlarge control for figures that sit inside another button (option
// rows), where the image itself can't be the trigger.
export function ZoomButton({ assetKey, className }: { assetKey: string; className?: string }) {
  const url = useAssetURL(assetKey);
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Enlarge figure"
        onClick={() => setOpen(true)}
        onKeyDown={stopEnterSpace}
        className={cx('group grid h-11 w-11 cursor-zoom-in place-items-center rounded-xl', className)}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface text-muted shadow-soft transition group-hover:text-fg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </span>
      </button>
      {open && <ImageDialog url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ImageDialog({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <DialogOverlay
      onClose={onClose}
      label="Figure"
      overlayClass="px-3"
      panelClass="relative max-w-[min(100vw-1.5rem,64rem)] p-2!"
    >
      <img src={url} alt="Figure" className="max-h-[85dvh] w-full rounded-xl bg-surface object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-2 right-2 grid h-11 w-11 place-items-center rounded-xl bg-surface/85 text-muted backdrop-blur-sm transition hover:text-fg"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </DialogOverlay>
  );
}
