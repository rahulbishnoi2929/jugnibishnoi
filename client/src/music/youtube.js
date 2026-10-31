// The YouTube IFrame API, loaded once.
//
// This is the engine and not the interface. The list, the artwork and the
// controls are ours; YouTube's job is to hold the audio and be told what
// to do with it. That split is what lets a playlist look like a playlist
// instead of looking like an embed.
//
// It is also the only way this can be legal. The songs are commercial
// recordings; putting the files on a public site would be infringement,
// quite apart from sixty of them being a quarter of a gigabyte. Here the
// rights holder is paid and nothing copyrighted lives in this repository.

let loading = null

export function loadYouTube() {
  if (loading) return loading
  loading = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)
    // The API calls one global when it is ready, so chain whatever is
    // already there rather than replacing it.
    const earlier = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      earlier?.()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return loading
}

// Takes whatever he pasted. A watch URL, a youtu.be link, an embed link,
// or the bare eleven characters — all of them are the same song, and
// asking him to strip a URL by hand is how a playlist stops getting
// added to.
export function videoId(input) {
  if (!input) return null
  const s = String(input).trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m =
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)
  return m ? m[1] : null
}

// Thumbnails are plain images on a CDN — no API call, no key, no quota.
// A list of fifty songs costs fifty <img> tags and nothing else.
export const thumbnail = (id, big = false) =>
  `https://i.ytimg.com/vi/${id}/${big ? 'hqdefault' : 'mqdefault'}.jpg`
