import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import Work from './pages/Work.jsx'

// Phase 1 ships one page, so it lives at /. When the journey lands in
// Phase 2, add a router and move this to /work — that is the whole change.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Work />
  </StrictMode>
)
