// What his body is doing at a given moment.
//
// Pure, and in its own file for the same reason layout.js is: nothing here
// imports React, so a renderer and a test can ask for the same numbers the
// component draws with. A dance you cannot measure is a dance you tune by
// reloading the page and squinting, and that is how you end up with a
// figure that sways left and right and calls it dancing.
//
// Everything is a fraction of a beat. `groove` is 0 standing still and 1
// fully into it; `open` is 0 arms down and 1 holding the cards out.

// How fast. 5.4 rad/s is about 51 to the bar, which is a nod rather than
// a workout — and a figure made of capsules looks foolish doing more.
export const BEAT = 5.4

// His legs, from the floor to the crotch. The squash below is worked
// against it, so it has to be the same number Figure builds with.
export const LEG = 1.95 / 2

// Where the arms go to hold something out. Measured, not eyeballed, and
// measured twice: pointing them at the lens made them vanish end-on
// behind a torso of the same colour, and then the cards covered what was
// left. These put the palms below the cards and outside them.
export const OFFER_ARM = -0.45
export const OFFER_OUT = 0.75
// And the elbow. An arm without one can only swing like a pendulum,
// which is most of why the first dance read as a mannequin: a shoulder
// is one joint, and a person dancing uses two. At 46 degrees the upper
// arm goes down and out and the forearm comes forward, which is the
// gesture in the photograph he sent.
export const OFFER_ELBOW = -0.75
// Nobody stands with their arms ramrod straight either.
const IDLE_ELBOW = -0.2

export function posture(t, { open = 0, groove = 0, idle = true } = {}) {
  const g = groove
  const beat = t * BEAT
  // Weight goes from one foot to the other every two beats, which is what
  // a body actually does to music. Everything else hangs off this: the
  // hips, the counter-twist, which knee is bent, which heel is up.
  const side = Math.sin(beat / 2)
  // And the bounce is on every beat, so twice per weight shift. Absolute,
  // because a body drops and recovers — it does not rise as far above
  // standing as it sinks below it.
  const drop = Math.abs(Math.sin(beat))

  // Breathing carries on underneath all of it — but quietly once he is
  // moving. At full amplitude it is the largest thing his chest does, and
  // nobody watches a dancer breathe. It also rides the cards in his hands
  // up and down the screen, and at 0.12 that was 66 pixels on a phone.
  const breath = idle ? Math.sin(t * 0.9) * 0.12 * (1 - 0.6 * g) : 0
  const sway = Math.sin(t * 0.7)

  // Shaped, not sinusoidal. A pure sine spends most of its time in the
  // middle, which is why the first version floated: it never arrived
  // anywhere. This spends longer at the extremes, so he is at the top or
  // the bottom of a beat rather than forever travelling between them.
  const hit = punch(Math.sin(beat))

  // An eight-beat phrase over the top, so two bars are not identical to
  // the next two. A loop is recognisable as a loop, and this is the
  // cheapest thing that stops it being one.
  const gp = g * (0.82 + 0.18 * Math.cos(beat / 4))

  // The dip is a knee bend, not a hover.
  //
  // Dropping the whole figure on the beat put his feet through the floor:
  // measured, they travelled 0.19 vertically, and the ground does not
  // move. So the torso sinks and the legs compress to meet it, which is
  // what knees are for. The feet stay where they are apart from the heel
  // that lifts.
  const dip = gp * (0.09 - drop * 0.13)

  return {
    // Breathing only. Everything the beat does is below.
    bodyY: breath,
    dip,
    // Shorter by exactly as much as the pelvis came down, so the top of
    // the leg still meets it.
    legSquash: (LEG + dip) / LEG,
    bodyRoll: Math.sin(t * 0.45) * 0.016 + gp * side * 0.022,
    chestY: 1 + Math.sin(t * 0.9) * 0.022 + gp * drop * 0.02,

    // Hips lead and the shoulders answer. A body that turns in one piece
    // is a mannequin on a turntable; the counter-rotation between the two
    // is most of what reads as dancing rather than swaying.
    hipsX: gp * side * 0.028,
    hipsTurn: gp * side * 0.24,
    upperTurn: gp * -side * 0.2,
    upperLean: gp * side * 0.025,

    // A nod, a fraction behind the bounce so it follows the music rather
    // than being wound by the same crank.
    headNod: gp * punch(Math.sin(beat - 0.6)) * 0.15,
    headTilt: gp * -side * 0.05,

    // Arms. Idle they hang and swing; offering they come up and out,
    // palms where a card can sit. The groove rides on top of whichever
    // pose he is in, so he keeps the cards up while he moves — and the
    // two are half a beat apart, because nobody pumps both at once.
    //
    // The forearm leads the upper arm by about a quarter of a beat, which
    // is what makes an arm look thrown rather than carried.
    armL: {
      x: lerp(sway * 0.22, OFFER_ARM, open) + gp * hit * 0.17,
      z: open * -OFFER_OUT + gp * side * 0.09,
      elbow: lerp(IDLE_ELBOW, OFFER_ELBOW, open) + gp * punch(Math.sin(beat + 1.6)) * 0.26,
    },
    armR: {
      x: lerp(-sway * 0.22, OFFER_ARM, open) + gp * punch(Math.sin(beat + Math.PI)) * 0.17,
      z: open * OFFER_OUT + gp * side * 0.09,
      elbow:
        lerp(IDLE_ELBOW, OFFER_ELBOW, open) +
        gp * punch(Math.sin(beat + Math.PI + 1.6)) * 0.26,
    },

    // Legs. The weighted one straightens and the free one lifts its heel
    // and swings a little — which is the step. Without this he was a torso
    // on a post, and no amount of arm movement covers that.
    legL: { x: gp * side * 0.18, lift: gp * Math.max(0, side) * 0.07 },
    legR: { x: gp * -side * 0.18, lift: gp * Math.max(0, -side) * 0.07 },
  }
}

const lerp = (a, b, t) => a + (b - a) * t

// Pushes a sine towards its extremes without moving where it crosses
// zero, so the timing of a beat is untouched and only its shape changes.
const punch = (s) => Math.sign(s) * Math.pow(Math.abs(s), 0.6)
