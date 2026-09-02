import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/tokens.css'
import './styles/app.css'
import Journey from './journey/Journey.jsx'
import Work from './pages/Work.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Journey />} />
        <Route path="/work" element={<Work />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
