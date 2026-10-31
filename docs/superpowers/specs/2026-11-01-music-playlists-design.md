# Music — playlists you can play

## Intent

The Music chapter works the way Campus works: branches off the node, tap
one, it opens. The difference is what is inside. Campus opens photographs;
Music opens a playlist, and the playlist plays.

The why, in his words: *you can tell a lot about a person with his
playlist.* This is not a music player bolted onto a portfolio. It is the
same thing every other chapter is doing — showing you who he is with
evidence rather than adjectives — and a playlist happens to be unusually
good evidence.

## What it does

Six branches off Music: **Chatpate, Sukoon, Lovable, Yaadaan, Rap,
Silent.**

Tap one and its panel opens with the songs listed, each row carrying that
song's thumbnail and title. The first song starts on its own — the tap
that opened the playlist is the gesture that permits audio, so this is
allowed on a phone. Tap any other row and playback jumps there. Play,
pause, next.

**The site changes with the music.** Per playlist, not per song. Chatpate
turns the whole site disco: hot colours, movement. Silent settles it —
quiet, dark, still. It slides between the two rather than snapping.

**The player outlives the panel.** Leave the playlist and it docks to the
side and keeps going. It stops when the listener stops it, and not before.
That means navigating from Music to Campus keeps the song playing and
keeps the mood with it: Campus is disco too, until the music stops.

## How it is built

**Audio: YouTube, through the IFrame Player API.** This is a decision, not
a preference, and it was his to overrule — it was put to him and he took
it. Commercial tracks cannot be hosted on a public GitHub Pages site
without infringing copyright, quite apart from a four-minute song being
four megabytes and sixty of them being past what the host will carry.
YouTube serves the audio, the rights holder is paid, and the embed is the
one they publish for this purpose. Adding a song becomes pasting a link.

Spotify was considered and rejected: it gives anonymous listeners
thirty-second previews, which fails the only requirement that matters.

**Thumbnails are free.** `img.youtube.com/vi/<id>/` serves them as plain
images with no API call, so a list of fifty songs costs fifty `<img>` tags
and nothing else.

**The player is a singleton above the router.** It has to be, or
navigation unmounts it mid-song. A provider at the app root owns the YT
instance and the current track; the panel and the docked mini-player are
both views onto it.

**Mood rides the existing accent machinery.** `--accent` is already a
registered CSS property that interpolates (docs/DESIGN.md §2), and chapter
colour already migrates through it. A mood is the same mechanism with more
properties: colour, background, and how much is moving.

## Goals

- Adding a song is pasting a URL into one file.
- It plays on a phone, first tap, no login.
- The mood change is felt before it is noticed.

## Non-goals

- No accounts, no saving, no likes, no shuffle history.
- No audio files in the repository, ever.
- Not a general music player. Six fixed playlists he curates.

## Anti-goals

Things that would make this a failure even if it worked:

- A YouTube video sitting in the middle of the page looking like an embed.
  The list and its artwork are the interface; the player is plumbing.
- The mood as a gimmick that fights legibility — text that cannot be read
  over a disco background is worse than no disco.
- Music that stops because you clicked something.

## Open, and left to the build

- **Six branches against four fan slots.** FAN in layout.js is a table of
  four positions and a test holds every chapter to it. Six needs new
  positions, measured, on a 375-wide phone where six cards across is 62
  pixels each. If six photo-cards will not fit, the branch for a playlist
  becomes something smaller than a photo-card, and that is a layout
  decision to be taken against a measurement rather than guessed.
- The six moods need defining as actual values.
- Whether the mini-player docks left or right, and what it looks like on a
  phone where there is no side to spare.
