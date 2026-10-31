import data from '../content/playlists.json'
import { thumbnail, videoId } from '../music/youtube.js'

// The playlists, with each song's id and thumbnail worked out once.
//
// A song whose link could not be read is dropped rather than left in the
// list as a row that does nothing when tapped. That is nearly always a
// half-pasted URL, and a missing row is a better bug report than a dead
// one.
export const playlists = data.playlists.map((p) => ({
  ...p,
  songs: p.songs
    .map((s) => {
      const id = videoId(s.yt)
      return id ? { ...s, id, thumb: thumbnail(id) } : null
    })
    .filter(Boolean),
}))

const byId = new Map(playlists.map((p) => [p.id, p]))

// Branch ids are playlist ids. Chapter branches are named for what they
// hold, so Music's six are chatpate, anytime, lovable, yaadaan, rap and
// silent — which is also why ids have to stay unique across chapters.
export const playlistFor = (id) => byId.get(id) ?? null
export const isPlaylist = (id) => byId.has(id)
