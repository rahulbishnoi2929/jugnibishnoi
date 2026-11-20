// The head and the skull inside it, generated off the main thread.
//
// Scattering fifteen thousand points over two distance fields is a few
// seconds of arithmetic on a laptop and more on a phone. On the main
// thread that is the whole page frozen the moment you open Build. Here
// the neurons and the projects are already moving while it arrives — the
// skin first, since it is the shape you recognise, then the bone.
import { head, skull } from './mind.js'

self.onmessage = (e) => {
  const { skin, bone } = e.data
  for (const [kind, s] of [
    ['skin', () => head({ count: skin })],
    ['bone', () => skull({ count: bone })],
  ]) {
    const out = s()
    self.postMessage({ kind, ...out }, [out.pos.buffer, out.normal.buffer, out.size.buffer])
  }
}
