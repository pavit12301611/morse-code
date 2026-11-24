# Morse Studio

Two things, nothing else: a **random Morse test** and a **complete code sheet**.

The test has three modes on the same shuffled deck:

- **Read** (default) — the written dots and dashes are shown, you name the character.
- **Write** — a character is shown, you type its dots and dashes.
- **Listen** — the character is sent in real CW audio (20 wpm, 620 Hz), you name it.

Every test reshuffles the pool, so the characters and their order are different each time.
Twenty questions per test, drawn from letters, numbers and punctuation (pick which sets you want).

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
