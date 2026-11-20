import { featured } from '../content/work.js'

// The projects in the head are the featured ones in work.js — the one
// place they are written down. Adding one there adds it here.
export const projects = featured

// What a project is called in the address: /c/build/zamindara.
export const projectId = (p) => p.title.toLowerCase()

// A project, shaped like a chapter so the panel can show it as it is:
// what it is up top, then what it does and why, then what it is made of.
// null for anything that is not one of them, so /c/build/nope is just
// the head with nothing open.
export function projectFor(id) {
  const p = projects.find((q) => projectId(q) === id)
  if (!p) return null
  return {
    id: projectId(p),
    title: p.title,
    lede: p.blurb,
    body: [p.body, p.problem].filter(Boolean),
    artifacts: p.stack?.length
      ? [{ type: 'stat', value: p.stack.join(' · '), label: 'built with' }]
      : [],
  }
}
