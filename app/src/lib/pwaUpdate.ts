import { registerSW } from 'virtual:pwa-register';
import { offerUpdate } from './updateGate';

const HOUR = 60 * 60 * 1000;

// Register the service worker and look for new deploys. A home-screen app on
// iOS is usually resumed rather than reloaded, so also check whenever it comes
// back to the foreground, and hourly while it stays open.
export function initPwaUpdates(): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      offerUpdate(() => void updateSW(true));
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => {});
      };
      window.setInterval(check, HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}
