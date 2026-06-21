import { useState } from 'react';
import { Button, DialogOverlay } from '../components/ui';
import { cx } from '../components/ui-utils';
import { getProgressRecord, isDisplayNameTaken, renameBank } from '../lib/quizbank/idb';
import type { BankMeta } from '../lib/quizbank/idb';
import { refreshMetas, removeBank } from '../lib/activeBank';
import { store } from '../state/useStore';

// Compact, accessible management list — the scale/management counterpart to the
// carousel (Codex rev4-P2): open, rename, remove, add.
export function ManageModules({
  metas, activeId, onClose, onOpen, onAdd,
}: {
  metas: BankMeta[];
  activeId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const trimmed = editName.trim();
  const editTaken = editing ? isDisplayNameTaken(trimmed, metas, editing) : false;
  const editOk = trimmed.length > 0 && !editTaken;

  async function saveRename(id: string) {
    if (!editOk) return;
    await renameBank(id, trimmed);
    await refreshMetas();
    setEditing(null);
  }

  async function exportProgress(m: BankMeta) {
    if (m.installedId === activeId) await store.flush(); // capture latest in-memory state
    const rec = await getProgressRecord(m.installedId);
    const data = JSON.stringify({ questions: rec?.questions ?? {}, settings: rec?.settings }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${m.installedId}-progress.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DialogOverlay onClose={onClose} label="Manage modules" panelClass="max-w-md">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-fg">Manage modules</h3>
        <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={onAdd}>Add</Button>
      </div>

      <div className="mt-4 flex max-h-[60vh] flex-col gap-2 overflow-auto">
        {metas.map((m) => (
          <div key={m.installedId} className="rounded-xl border border-line px-3 py-2.5">
            {editing === m.installedId ? (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-line-strong"
                />
                <div className="flex items-center gap-2">
                  <span className={cx('text-xs', editTaken ? 'text-bad' : 'text-faint')}>
                    {editTaken ? 'Name already in use' : ''}
                  </span>
                  <Button variant="primary" className="ml-auto px-3 py-1 text-xs" disabled={!editOk} onClick={() => void saveRename(m.installedId)}>
                    Save
                  </Button>
                  <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{m.displayName}</span>
                    {m.installedId === activeId && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Active</span>
                    )}
                  </div>
                  <div className="tnum text-xs text-faint">
                    {m.questionCount.toLocaleString()} questions · {Math.round(m.summary.progressPct * 100)}% mastered
                  </div>
                </div>
                {confirmRemove === m.installedId ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => { void removeBank(m.installedId); setConfirmRemove(null); }}>
                      Delete
                    </Button>
                    <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setConfirmRemove(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {m.installedId !== activeId && (
                      <Button className="px-3 py-1 text-xs" onClick={() => onOpen(m.installedId)}>Open</Button>
                    )}
                    <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => void exportProgress(m)}>
                      Export
                    </Button>
                    <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => { setEditing(m.installedId); setEditName(m.displayName); }}>
                      Rename
                    </Button>
                    <Button variant="ghost" className="px-2.5 py-1 text-xs text-bad hover:bg-bad/10" onClick={() => setConfirmRemove(m.installedId)}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button className="mt-4 w-full" onClick={onClose}>Done</Button>
    </DialogOverlay>
  );
}
