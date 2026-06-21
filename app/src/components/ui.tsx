import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from './ui-utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-onprimary shadow-soft hover:opacity-90 active:scale-[0.975]',
  secondary:
    'bg-surface text-fg border border-line hover:border-line-strong active:scale-[0.985]',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'text-bad border border-bad/30 hover:bg-bad/10 active:scale-[0.985]',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'secondary', className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition duration-150 ease-out disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Card({
  children,
  className,
  interactive,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-2xl bg-surface shadow-soft',
        interactive &&
          'cursor-pointer transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-tight"
      style={{
        color: color ?? 'var(--muted)',
        background: color ? `color-mix(in oklab, ${color} 14%, transparent)` : 'var(--surface-2)',
      }}
    >
      {children}
    </span>
  );
}

export function AccuracyBar({ value, height = 6 }: { value: number | null; height?: number }) {
  const ratio = value ?? 0;
  const color =
    value === null
      ? 'var(--line-strong)'
      : ratio >= 0.8
        ? 'var(--good)'
        : ratio >= 0.6
          ? 'var(--warn)'
          : 'var(--bad)';
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: 'var(--surface-2)' }}>
      <div
        style={{
          width: `${ratio * 100}%`,
          height: '100%',
          background: color,
          borderRadius: 999,
          transition: 'width .45s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5 shadow-soft">
      <div className="tnum text-[1.6rem] font-semibold leading-none tracking-tight text-fg">{value}</div>
      <div className="mt-1.5 text-xs font-medium text-muted">{label}</div>
      {sub != null && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function DialogOverlay({
  children,
  onClose,
  label,
  panelClass,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  panelClass?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length) focusable[0].focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={panelRef}
        className={cx('w-full min-w-0 rounded-2xl bg-surface p-5 shadow-pop', panelClass ?? 'max-w-sm')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
