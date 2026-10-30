import { useEffect, useMemo } from 'react'

// Build a GPU resource, and give it back when the component goes.
//
// React Three Fiber disposes what it constructs itself — a <bufferGeometry>
// written as a child element is its to clean up. An object built in
// useMemo and handed over as a prop, `<points geometry={g} material={m} />`,
// is not: R3F only borrows it, and when the component unmounts the buffer
// stays on the GPU.
//
// Which mattered here, because the cosmos unmounts every time you open a
// chapter and is rebuilt when you come back. Five visits left five
// galaxies — forty thousand points apiece — sitting in video memory with
// nothing pointing at them. The globe did the same on a viewport change.
//
// Same arguments as useMemo, so it reads as a drop-in.
export function useDisposable(make, deps) {
  // Same contract as useMemo itself: the caller's deps are the deps, and
  // the factory is deliberately not one of them. The rule cannot see
  // through the indirection, which is the one case it is wrong about.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const thing = useMemo(make, deps)
  useEffect(() => () => thing.dispose(), [thing])
  return thing
}
