import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import App from './App'
import '@fontsource-variable/manrope'
import '@fontsource/ibm-plex-sans-thai/thai-400.css'
import '@fontsource/ibm-plex-sans-thai/thai-500.css'
import '@fontsource/ibm-plex-sans-thai/thai-600.css'
import '@fontsource/ibm-plex-sans-thai/thai-700.css'
import './styles.css'

function Root() {
  const [dismissed, setDismissed] = useState(false)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  return (
    <>
      <App />
      {needRefresh && !dismissed && (
        <aside className="update-toast" aria-label="อัปเดตแอป">
          <p>มีแอปเวอร์ชันใหม่</p>
          <button className="primary-button" onClick={() => void updateServiceWorker(true)}>อัปเดต</button>
          <button className="subtle-button" onClick={() => setDismissed(true)}>ภายหลัง</button>
        </aside>
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
