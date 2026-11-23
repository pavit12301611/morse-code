# Morse Studio

A calm, rigorous place to learn Morse code — and to learn to **copy it fast enough to be useful**.

Most "learn Morse" tools show you a dot-and-dash chart and call it a day. Morse is a sound language,
so this app teaches it that way: every letter arrives as real CW audio at a fast character speed,
with wide Farnsworth gaps while you build the ear.

## What's inside

- **Curriculum (Koch method).** 40 characters in 20 lessons, two at a time, mixed with review.
  A lesson passes at 90% accuracy before the next unlocks.
- **Recognition drill.** One clean pass per character. Answers are timed and every letter's
  accuracy/latency is tracked; weak letters are re-served inside the set and weighted heavier in
  future sets. Modes: single characters, 5-character groups, common words.
- **Head copy.** Copy a whole transmission in memory, then write it down — groups, words,
  amateur callsigns, plain sentences and QSO lines. A speed ladder tracks the highest effective
  speed you have actually copied at 90%+.
- **Sending.** Straight key or paddle keyer with a live decoder, per-element timing envelope,
  and scoring against a target. Real sidetone, real spacing rules (1 / 3 / 7 units).
- **Signal table.** Full alphabet, numbers, punctuation and prosigns, all playable; patterns can be
  covered for self-testing.
- **Progress.** Accuracy trend, 14-day practice chart, per-character signal report, session log.
- **Settings.** Tone frequency / waveform / volume, character speed, Farnsworth spacing, presets,
  keyer default, themes, JSON export & import, reset.

## Timing model

Based on the PARIS standard: a dit is `1200 / WPM` ms, a dah is three dits. With Farnsworth
spacing, characters are sent at the *character speed* while the extra silence needed to reach the
*effective speed* is split between letter gaps and word gaps. The app computes it exactly, so the
effective WPM label is not decorative.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # production build
```

React + Vite + Web Audio, no backend. All progress is stored in `localStorage` on the device.

## Browser support

Current Chrome, Safari, Firefox and Edge. Audio requires one user gesture (a click or key press)
before the tone can start, which the app handles automatically.
