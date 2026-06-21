import { applyDataset } from './dataset';
import { buildDataset } from './buildDataset';
import { store as progressStore } from './storage';
import {
  deleteBank, getActiveBankId, getBankRecord, getProgressRecord, listBankMeta,
  revokeBankAssetURLs, setActiveBankId,
} from './quizbank/idb';
import type { BankMeta } from './quizbank/idb';
import type { ValidatedBank } from './quizbank/format';

// Boot + switch orchestrator. Commits the dataset snapshot, progress slice, and
// active-bank id together so the UI never shows bank A's questions with bank B's
// progress. Exposes a subscribable store for the boot gate.

export type ActiveStatus = 'loading' | 'empty' | 'ready' | 'error';

export interface ActiveState {
  status: ActiveStatus;
  activeBankId: string | null;
  metas: BankMeta[];
  error: string | null;
  ephemeral: boolean; // sample trial active (not a persisted bank)
}

let state: ActiveState = { status: 'loading', activeBankId: null, metas: [], error: null, ephemeral: false };
const listeners = new Set<() => void>();
let requestedSwitchId: string | null = null;
let switchPromise: Promise<void> | null = null;

function set(patch: Partial<ActiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const activeBank = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  snapshot(): ActiveState {
    return state;
  },
};

// Loads a bank's content + progress into memory atomically (dataset first so the
// progress sanitizer validates against the right qid set).
async function activate(installedId: string): Promise<void> {
  const [bank, prog] = await Promise.all([getBankRecord(installedId), getProgressRecord(installedId)]);
  if (!bank) throw new Error(`bank "${installedId}" not found`);
  applyDataset(buildDataset(installedId, bank.manifest));
  progressStore.adopt(installedId, prog ?? null);
  await setActiveBankId(installedId);
}

export async function initActiveBank(): Promise<void> {
  try {
    const metas = await listBankMeta();
    if (metas.length === 0) {
      applyDataset(null);
      progressStore.detach();
      set({ status: 'empty', metas: [], activeBankId: null, error: null, ephemeral: false });
      return;
    }
    const stored = await getActiveBankId();
    const target = metas.find((m) => m.installedId === stored)?.installedId ?? metas[0].installedId;
    await activate(target);
    set({ status: 'ready', metas, activeBankId: target, error: null, ephemeral: false });
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : 'failed to load banks' });
  }
}

export function switchBank(installedId: string): Promise<void> {
  if (!switchPromise && installedId === state.activeBankId) return Promise.resolve();

  requestedSwitchId = installedId;
  set({ status: 'loading', error: null });

  if (!switchPromise) {
    switchPromise = (async () => {
      try {
        // Serialize rapid selections and keep draining until the latest requested
        // bank is active. The UI remains behind the loading gate throughout.
        while (requestedSwitchId !== null) {
          const target = requestedSwitchId;
          requestedSwitchId = null;
          if (target === state.activeBankId) continue;

          const prev = state.activeBankId;
          await progressStore.flush();
          if (prev) revokeBankAssetURLs(prev);
          await activate(target);
          set({ activeBankId: target, error: null, ephemeral: false });
        }
        set({ status: 'ready', error: null });
      } catch (e) {
        requestedSwitchId = null;
        set({ status: 'error', error: e instanceof Error ? e.message : 'failed to switch bank' });
      } finally {
        switchPromise = null;
      }
    })();
  }

  return switchPromise;
}

export async function afterImport(installedId: string): Promise<void> {
  const prev = state.activeBankId;
  if (prev && prev !== installedId) {
    await progressStore.flush();
    revokeBankAssetURLs(prev);
  }
  const metas = await listBankMeta();
  await activate(installedId);
  set({ status: 'ready', metas, activeBankId: installedId, error: null, ephemeral: false });
}

export async function removeBank(installedId: string): Promise<void> {
  await progressStore.flush();
  await deleteBank(installedId); // revokes its asset URLs + reassigns the active pointer
  const metas = await listBankMeta();
  if (metas.length === 0) {
    applyDataset(null);
    progressStore.detach();
    set({ status: 'empty', metas: [], activeBankId: null, error: null, ephemeral: false });
    return;
  }
  const next = (await getActiveBankId()) ?? metas[0].installedId;
  await activate(next);
  set({ status: 'ready', metas, activeBankId: next, error: null, ephemeral: false });
}

export async function refreshMetas(): Promise<void> {
  set({ metas: await listBankMeta() });
}

// Load a validated bank into memory WITHOUT persisting it — the sample trial.
// Progress is in-memory only; metas (real banks) are untouched.
export function enterEphemeral(validated: ValidatedBank): void {
  applyDataset(buildDataset(validated.manifest.id, validated.manifest));
  progressStore.adoptEphemeral();
  set({ status: 'ready', activeBankId: null, error: null, ephemeral: true });
}

// Discard the sample trial and return to the real state (a bank, or onboarding).
export async function exitEphemeral(): Promise<void> {
  progressStore.detach();
  const metas = await listBankMeta();
  if (metas.length === 0) {
    applyDataset(null);
    set({ status: 'empty', metas: [], activeBankId: null, error: null, ephemeral: false });
    return;
  }
  const next = (await getActiveBankId()) ?? metas[0].installedId;
  await activate(next);
  set({ status: 'ready', metas, activeBankId: next, error: null, ephemeral: false });
}
