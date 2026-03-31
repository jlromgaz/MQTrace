import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PlaybackProvider } from './context/PlaybackContext.jsx'
import { SystemLogsProvider } from './context/SystemLogsContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PlaybackProvider>
      <SystemLogsProvider>
        <App />
      </SystemLogsProvider>
    </PlaybackProvider>
  </StrictMode>,
)

