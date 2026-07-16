import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import JoinLunch from './pages/JoinLunch'
import CancelLunch from './pages/CancelLunch'

const path = window.location.pathname

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/join' ? <JoinLunch />
      : path === '/cancel' ? <CancelLunch />
      : <App />}
  </StrictMode>
)