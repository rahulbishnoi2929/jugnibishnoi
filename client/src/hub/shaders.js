import * as THREE from 'three'

// Two small shaders, both there for the same reason: three's stock
// materials draw the cosmic stages as diagrams and the ask was for
// something that looks photographed.

// ---------- stars ----------

// three's PointsMaterial gives every point in a cloud the same size and
// draws it as a hard-edged square. Both are why the first galaxy read as a
// logo: a star field is a magnitude distribution, not a constant, and a
// star is a soft round smudge, not a quad.
//
// This is the smallest shader that fixes both — a per-point size attribute
// and a gaussian falloff across gl_PointCoord. Everything out here uses it:
// the galaxy's four layers, the field of galaxies, the backdrop, and the
// sun's glow, which is one very large point.
//
// gl_PointSize works out to aSize * px * dpr, because uSize carries the
// camera distance and uScale carries the half-height. Per-point
// attenuation still varies with each point's own depth, which is what
// keeps the near edge of a disc bigger than the far one.
export function starMaterial({
  blending = THREE.AdditiveBlending,
  falloff = 3.4,
  elliptical = false,
} = {}) {
  return new THREE.ShaderMaterial({
    defines: elliptical ? { ELLIPTICAL: '' } : {},
    uniforms: {
      uScale: { value: 400 }, // half the canvas height, times the pixel ratio
      uSize: { value: 0.05 }, // world units per unit of aSize
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      uniform float uScale;
      uniform float uSize;
      varying vec3 vColor;

      #ifdef ELLIPTICAL
        attribute float aAspect;
        attribute float aAngle;
        varying float vAspect;
        varying float vAngle;
      #endif

      void main() {
        vColor = color;
        #ifdef ELLIPTICAL
          vAspect = aAspect;
          vAngle = aAngle;
        #endif
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Clamped, because a few drivers cap gl_POINT_SIZE_RANGE as low as
        // 63 and the haze layer is deliberately made of big soft blobs.
        gl_PointSize = min(aSize * uSize * (uScale / -mv.z), 56.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;

      #ifdef ELLIPTICAL
        varying float vAspect;
        varying float vAngle;
      #endif

      void main() {
        vec2 d = gl_PointCoord - 0.5;

        #ifdef ELLIPTICAL
          // A galaxy is a disc seen at some angle, so squash and turn the
          // falloff. Round dots read as stars, which is exactly the wrong
          // thing when every point is supposed to be a galaxy.
          float c = cos(vAngle);
          float s = sin(vAngle);
          d = vec2(d.x * c - d.y * s, (d.x * s + d.y * c) / max(vAspect, 0.08));
        #endif

        float r2 = dot(d, d) * 4.0;
        // A gaussian core, then a hard taper to nothing at the edge of the
        // quad so there is never a visible square boundary.
        float a = exp(-r2 * ${falloff.toFixed(2)}) * (1.0 - smoothstep(0.7, 1.0, r2));
        if (a < 0.004) discard;
        gl_FragColor = vec4(vColor, a * uOpacity);
      }
    `,
    // three declares the colour attribute for us under this flag.
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending,
  })
}

// Sets the two uniforms that depend on the frame rather than the cloud.
export function tuneStars(material, { px, dist, height, dpr, size, opacity }) {
  const u = material.uniforms
  u.uScale.value = (height / 2) * dpr
  u.uSize.value = px * (dist / (height / 2)) * size
  u.uOpacity.value = opacity
}

// ---------- orbits ----------

// An orbit line that dims on its far side.
//
// A ring drawn at one brightness all the way round is a flat wire: nothing
// tells you which half is behind the sun. Fading the far half is the whole
// difference between eight ellipses and eight orbits, and it costs one
// varying — the fragment's depth relative to the middle of the stage,
// normalised by the stage's own radius so it works at any zoom.
export function orbitMaterial(color, radius) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRadius: { value: radius },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uRadius;
      varying float vBehind;

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec4 middle = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        // The view matrix is orthonormal, so a column of modelViewMatrix is
        // as long as the model's own scale — which is how this stays right
        // while the stage scales through four orders of magnitude.
        float scale = length(modelViewMatrix[0].xyz);
        vBehind = clamp((middle.z - mv.z) / (2.0 * uRadius * scale) + 0.5, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vBehind;

      void main() {
        gl_FragColor = vec4(uColor, mix(1.0, 0.16, vBehind) * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  })
}

// ---------- planets ----------

// A planet lit by its own sun, and by nothing else.
//
// The hub has an ambient light and two directional ones aimed to flatter a
// standing figure; borrowing those would light Neptune from Punjab. And a
// flat basic material — what this replaces — draws each planet as a plain
// disc, which is most of why the solar system did not read as three
// dimensional.
//
// The light direction is worked out in the stage's own space, where the sun
// is exactly at the origin: for a fragment on a sphere centred at uCentre,
// the surface normal is the sphere-local position and the direction to the
// sun is the way back to the origin. No light object, no uniform to keep in
// step with the stage's rotation.
export function planetMaterial(color, centre, axis = [0, 1, 0], bands = 0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCentre: { value: new THREE.Vector3(centre[0], centre[1], centre[2]) },
      uAxis: { value: new THREE.Vector3(axis[0], axis[1], axis[2]).normalize() },
      uBands: { value: bands },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uCentre;
      uniform vec3 uAxis;
      uniform float uBands;
      uniform float uOpacity;
      varying vec3 vLocal;

      void main() {
        vec3 N = normalize(vLocal);
        vec3 L = normalize(-(uCentre + vLocal));
        float d = max(dot(N, L), 0.0);
        // A soft terminator rather than a hard one, and a little light left
        // on the night side: at two pixels across, a true shadow is just a
        // black bite taken out of the dot.
        float lit = pow(d, 0.6) * 0.88 + 0.12;

        // Banding about the planet's own axis, not about the ecliptic. The
        // inner sine makes the stripes uneven widths rather than a barcode.
        float lat = dot(N, uAxis);
        lit *= 1.0 + uBands * 0.17 * sin(lat * 19.0 + sin(lat * 6.0) * 1.7);

        gl_FragColor = vec4(uColor * lit, uOpacity);
      }
    `,
    transparent: true,
  })
}

// ---------- Saturn ----------

// The rings as a banded annulus rather than five line circles.
//
// Real structure, from the outside in: the A ring, the Cassini division,
// the bright B ring, then the faint C ring. Banding it by radius in the
// shader is what makes a twelve-pixel smudge read as rings, and on a
// desktop it is plainly a ringed planet.
export function ringMaterial(color, centre, inner, outer) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCentre: { value: new THREE.Vector3(centre[0], centre[1], centre[2]) },
      uInner: { value: inner },
      uOuter: { value: outer },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uInner;
      uniform float uOuter;
      uniform float uOpacity;
      varying vec3 vLocal;

      void main() {
        float r = length(vLocal);
        // Where we are across the ring system, 0 at the inner edge.
        float f = (r - uInner) / (uOuter - uInner);

        // C ring faint, B ring bright, Cassini division dark, A ring
        // middling, and a soft outer edge.
        float a = 0.30;
        a += 0.55 * smoothstep(0.16, 0.28, f);
        a -= 0.48 * smoothstep(0.60, 0.66, f) * (1.0 - smoothstep(0.70, 0.76, f));
        a *= 1.0 - smoothstep(0.94, 1.0, f);
        a *= smoothstep(0.0, 0.06, f);

        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}
