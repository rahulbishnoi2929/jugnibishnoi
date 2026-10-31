import { createContext, useContext } from 'react'

// The context lives apart from the components that use it so that editing
// the player does not blow away what is playing: a module exporting both
// a hook and a component cannot be hot-replaced, and fast refresh falls
// back to a full reload. Which, for a music player, is the one thing you
// would notice.
export const MusicContext = createContext(null)
export const useMusic = () => useContext(MusicContext)
