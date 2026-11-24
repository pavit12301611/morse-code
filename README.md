# Morse Studio

Two things, nothing else: a **random Morse listening test** and a **complete code sheet**.

Open the app and press start — it sends one character at a time in real CW timing (20 wpm,
620 Hz) and you type what you heard. Every test reshuffles the pool, so the characters and their
order are different each time. Twenty questions per test, drawn from letters, numbers and
punctuation (pick which sets you want).

The **Morse codes** tab is the full reference: A–Z, 0–9, all 18 punctuation marks and symbols,
and the common prosigns (AR, SK, BT, KN, HH, SOS). It is print-friendly too.

## Timing

A dit is `1200 / WPM` ms and a dash is three dits, following the PARIS standard. Letters are
spaced three dits apart.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # production build in dist/
```

React + Vite + Web Audio, no backend, no tracking. Audio needs one tap or key press before the
tone can start, which happens naturally when you start a test.
