import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/tokens.css'
import './styles/app.css'
import Work from './pages/Work.jsx'

// three.js is ~150KB gzipped. Split it so /work — the page a recruiter
// opens — never downloads a line of it.
const Hub = lazy(() => import('./hub/Hub.jsx'))
const Journey = lazy(() => import('./journey/Journey.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="boot" />}>
        <Routes>
          <Route path="/" element={<Hub />} />
          {/* a branch is a real URL, so it is shareable and Back works */}
          <Route path="/c/:id" element={<Hub />} />
          {/* a chapter's own branch, e.g. /c/campus/hackathon */}
          <Route path="/c/:id/:sub" element={<Hub />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/work" element={<Work />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>
)
