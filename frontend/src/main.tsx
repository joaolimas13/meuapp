import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { CapturePage } from './components/CapturePage'

// /captura = página enxuta para o celular; qualquer outro caminho = painel completo.
const isCapture = location.pathname.replace(/\/$/, '') === '/captura'

createRoot(document.getElementById('root')!).render(<StrictMode>{isCapture ? <CapturePage /> : <App />}</StrictMode>)
