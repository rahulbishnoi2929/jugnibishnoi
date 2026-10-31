import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/tokens.css'
import './styles/app.css'
import Work from './pages/Work.jsx'
import { MusicProvider } from './music/Player.jsx'

// three.js is ~150KB gzipped. Split it so /work — the page a recruiter
// opens — never downloads a line of it.
const Hub = lazy(() => import('./hub/Hub.jsx'))
const Journey = lazy(() => import('./journey/Journey.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Pages serves this under /jugnibishnoi/, so the router has to be
        told or every route resolves one level too high. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* Outside the Routes on purpose. A song has to survive leaving the
          page it was started from, and anything inside a route is
          unmounted the moment you navigate. It also owns the wash that
          colours the site to match whatever is playing. */}
      <MusicProvider>
      <div className="mood-wash" aria-hidden="true" />
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
      </MusicProvider>
    </BrowserRouter>
  </StrictMode>
)
