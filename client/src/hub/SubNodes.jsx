import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { cardFor, labelScaleFor } from './layout.js'
import { setsFor } from '../lib/media.js'

// A chapter's own branches, growing out of its node the way the chapters
// grow out of his head — but these are rectangles with a photograph in
// them rather than dots, because by this point there is something to show.
//
// One texture per branch, and it is the 480px thumbnail rather than the
// full frame: four previews cost about as much as one photograph.
//
// The size comes from layout.js and differs by viewport, because these sit
// much nearer the camera than the point it is aimed at — see cardFor.

// Scratch for the billboarding, so the frame loop allocates nothing.
const _parent = new THREE.Quaternion()
const _face = new THREE.Quaternion()

export default function SubNodes({ branches, chapterId, narrow, accent, active, onPick, zoom }) {
  const card = cardFor(narrow)
  return (
    <group>
      {branches.map((b, i) => (
        <SubNode
          key={b.id}
          branch={b}
          index={i}
          chapterId={chapterId}
          card={card}
          narrow={narrow}
          accent={accent}
          state={!active ? 'idle' : active === b.id ? 'on' : 'off'}
          zoom={zoom}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

function SubNode({ branch, index, chapterId, card: size, narrow, accent, state, onPick, zoom }) {
  const W = size.w
  const H = size.h
  const [hover, setHover] = useState(false)
  const card = useRef()
  const frame = useRef()
  const line = useRef()
  const label = useRef()
  const grew = useRef(0)

  // The first photograph under this branch, if it has any. A branch with
  // nothing in it yet still gets a frame — an empty one, which is honest.
  const preview = useMemo(() => {
    const sets = setsFor(chapterId, branch.id)
    return sets[0]?.photos[0]?.thumb ?? null
  }, [chapterId, branch.id])

  const curve = useMemo(() => {
    const mid = branch.parent.clone().lerp(branch.pos, 0.55)
    mid.x += 0.22
    mid.y += 0.12
    return new THREE.QuadraticBezierCurve3(branch.parent, mid, branch.pos).getPoints(24)
  }, [branch])

  // The frame around the picture, as a closed loop.
  const outline = useMemo(() => {
    const x = W / 2
    const y = H / 2
    return [
      new THREE.Vector3(-x, -y, 0),
      new THREE.Vector3(x, -y, 0),
      new THREE.Vector3(x, y, 0),
      new THREE.Vector3(-x, y, 0),
      new THREE.Vector3(-x, -y, 0),
    ]
  }, [W, H])

  useFrame((state3, dt) => {
    const k = 1 - Math.pow(0.000004, Math.min(dt, 0.1))
    grew.current = Math.min(1, grew.current + dt * 1.6)
    const on = grew.current > index * 0.18

    const lit = !on ? 0 : state === 'off' ? 0.25 : hover || state === 'on' ? 1 : 0.85
    const size = !on ? 0 : hover || state === 'on' ? 1.06 : 1

    // Square on to the camera whatever the turntable is doing. A picture
    // seen edge-on is not a picture.
    if (card.current?.parent) {
      card.current.parent.getWorldQuaternion(_parent)
      _face.copy(_parent).invert().multiply(state3.camera.quaternion)
      card.current.quaternion.copy(_face)
      if (frame.current) frame.current.quaternion.copy(_face)
    }

    card.current.scale.setScalar(THREE.MathUtils.lerp(card.current.scale.x, size, k))
    card.current.material.opacity = THREE.MathUtils.lerp(
      card.current.material.opacity,
      lit,
      k
    )
    if (frame.current) {
      frame.current.scale.copy(card.current.scale)
      frame.current.material.opacity = THREE.MathUtils.lerp(
        frame.current.material.opacity,
        lit * (hover || state === 'on' ? 0.9 : 0.35),
        k
      )
    }
    if (line.current) {
      line.current.material.opacity = THREE.MathUtils.lerp(
        line.current.material.opacity,
        !on ? 0 : state === 'off' ? 0.1 : 0.5,
        k
      )
    }
    if (label.current) {
      label.current.style.opacity = (on ? (state === 'off' ? 0.35 : 1) : 0).toFixed(2)
      label.current.style.scale = labelScaleFor(zoom?.current ?? 1).toFixed(3)
    }
  })

  const pick = (e) => {
    e.stopPropagation()
    onPick(branch.id)
  }

  return (
    <group>
      {/* The connector, on a desktop only. There the branches fan down a
          column and the line says which node they came from. On a phone
          they are a row sitting directly under that node, so the line has
          nothing to explain — and measured, it ran horizontally straight
          across the top edge of the two middle photographs. */}
      {!narrow && (
        <Line
          ref={line}
          points={curve}
          color={accent}
          transparent
          opacity={0}
          lineWidth={state === 'on' || hover ? 2 : 1}
        />
      )}

      <mesh
        ref={card}
        position={branch.pos}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
        onClick={pick}
      >
        <planeGeometry args={[W, H]} />
        {preview ? (
          <Suspense fallback={<meshBasicMaterial color="#14161a" transparent opacity={0} />}>
            <Picture url={preview} aspect={W / H} />
          </Suspense>
        ) : (
          <meshBasicMaterial color="#14161a" transparent opacity={0} />
        )}
      </mesh>

      {/* The edge of the frame, which is what makes it read as a picture
          rather than as a floating rectangle of colour.
          drei's Line rather than a raw <line> with an inline
          bufferAttribute: the pane this was written in cannot render a
          frame, so an untested JSX shape would go out unverified, and this
          one is already doing the branch curve two elements up. */}
      <Line
        ref={frame}
        points={outline}
        position={branch.pos}
        color={accent}
        transparent
        opacity={0}
        lineWidth={state === 'on' || hover ? 1.6 : 1}
      />

      {/* On a desktop the name hangs under its picture; there is a column
          of them and room below each. On a phone it sits along the bottom
          edge of the picture instead — the row ends 12 pixels above the top
          of his head, so a name underneath lands on his face. */}
      <Html
        position={[
          branch.pos.x,
          branch.pos.y - H / 2 + (narrow ? 0.07 : -0.09),
          branch.pos.z,
        ]}
        center
        distanceFactor={2.6}
        zIndexRange={[9, 0]}
      >
        <button
          ref={label}
          className={
            'sub-label' + (hover ? ' is-hot' : '') + (narrow ? ' is-on-photo' : '')
          }
          style={{ '--node': accent, opacity: 0 }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => onPick(branch.id)}
        >
          {branch.title}
        </button>
      </Html>
    </group>
  )
}

// The photograph itself, cropped to fill the rectangle the way the grid
// crops its thumbnails — these are seventeen landscape to fifteen portrait,
// and letterboxing half of them would look like a mistake.
function Picture({ url, aspect }) {
  const map = useLoader(THREE.TextureLoader, url)

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    const image = map.image
    if (!image?.width) return
    const plane = aspect
    const photo = image.width / image.height
    if (photo > plane) {
      map.repeat.set(plane / photo, 1)
      map.offset.set((1 - plane / photo) / 2, 0)
    } else {
      map.repeat.set(1, photo / plane)
      map.offset.set(0, (1 - photo / plane) / 2)
    }
    map.needsUpdate = true
  }, [map, aspect])

  return <meshBasicMaterial map={map} transparent opacity={0} toneMapped={false} />
}
