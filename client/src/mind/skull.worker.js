// The skull, generated off the main thread.
//
// Scattering ten thousand points over the distance field is a second or
// two of arithmetic on a laptop and several on a phone. On the main
// thread that is the whole page frozen the moment you open Build. Here
// the neurons and the projects are already moving while the bone arrives.
import { skull } from './mind.js'

self.onmessage = (e) => {
  const s = skull({ count: e.data.count })
  self.postMessage(s, [s.pos.buffer, s.normal.buffer, s.size.buffer])
}
