// The opponent, off the main thread.
//
// Hard thinks for up to a second and a half. On the main thread that is a
// second and a half where the globe stops turning, the dock stops drawing
// and a tap does nothing — the whole site freezes while a pawn decides.
// Here it is just a message that arrives when it arrives.
import { bestMove } from './ai.js'

self.onmessage = (e) => {
  const { fen, level, id } = e.data
  try {
    self.postMessage({ id, move: bestMove(fen, level) })
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) })
  }
}
