import { featured } from '../content/work.js'

// The projects in the head are the featured ones in work.js — the one
// place they are written down. Adding one there adds it here.
export const projects = featured

// What a project is called in the address: /c/build/zamindara.
export const projectId = (p) => p.title.toLowerCase()
