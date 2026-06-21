import { useSyncExternalStore } from 'react';
import { store } from '../lib/storage';
import { activeBank } from '../lib/activeBank';
import type { ActiveState } from '../lib/activeBank';
import type { ProgressStore } from '../types';

export function useProgress(): ProgressStore {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

export function useActiveBank(): ActiveState {
  return useSyncExternalStore(activeBank.subscribe, activeBank.snapshot, activeBank.snapshot);
}

export { store };
