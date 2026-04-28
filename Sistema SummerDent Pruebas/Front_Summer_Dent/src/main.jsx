import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/tokens.css'
import './styles/ui.css'
import './styles/feedback.css'
import './styles/dashboard.css'
import './styles/pacientes.css'
import './styles/citas.css'
import './styles/doctores.css'
import './styles/tratamientos.css'
import './styles/finanzas.css'
import './styles/financiero.css'
import './styles/inventario.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
