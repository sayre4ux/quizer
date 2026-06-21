import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App.tsx'
import { requestPersistentStorage } from './lib/persist'
import { initActiveBank } from './lib/activeBank'

void requestPersistentStorage()
void initActiveBank()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dismiss the cold-start boot splash once the app has mounted, holding it for a
// minimum so it never flashes, then fading it out. GPU-only opacity transition.
function dismissBoot() {
  const el = document.getElementById('boot')
  if (!el) return
  const start = (window as unknown as { __bootStart?: number }).__bootStart ?? Date.now()
  const MIN_MS = 2200
  const wait = Math.max(0, MIN_MS - (Date.now() - start))
  window.setTimeout(() => {
    el.classList.add('boot--done')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
    window.setTimeout(() => el.remove(), 500) // fallback if transitionend doesn't fire
  }, wait)
}
requestAnimationFrame(dismissBoot)
