import { setsFor } from '../lib/media.js'

// The photos under one branch, in sets.
//
// Square thumbnails, cropped from the middle. That is not a default — the
// thirty-two photos here are seventeen landscape and fifteen portrait, and
// an even split is the awkward case: a masonry grid with orientations
// alternating one to one jumps about, while a square grid stays calm and
// lets you read the set as a set. The crop is only ever the thumbnail; open
// one and you get the whole frame.
//
// Sets with no files in them do not appear at all, which is why
// captions.json can list volleyball and shooting before there are any.
export default function Gallery({ chapterId, branchId, onOpen }) {
  const sets = setsFor(chapterId, branchId)
  if (!sets.length) return null

  // One flat list across every set, so the arrows in the plate walk the
  // whole branch rather than stopping at the end of a sport.
  const all = sets.flatMap((s) => s.photos)

  return (
    <div className="gallery">
      {sets.map((set) => (
        <section className="gallery-set" key={set.set}>
          <h3 className="gallery-title">
            {set.title}
            <span className="gallery-count">{set.photos.length}</span>
          </h3>
          {set.lede && <p className="gallery-lede">{set.lede}</p>}

          <ul className="gallery-grid">
            {set.photos.map((photo) => (
              <li key={photo.id}>
                <button
                  className="gallery-thumb"
                  onClick={() => onOpen(photo, all)}
                  aria-label={'Open: ' + photo.label}
                >
                  {photo.video ? (
                    <video src={photo.url} muted playsInline preload="metadata" />
                  ) : (
                    <img
                      src={photo.thumb}
                      alt={photo.label}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
