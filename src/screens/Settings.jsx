import React, { useRef, useState } from 'react'
import { useApp } from '../lib/appContext'
import { store, useStore } from '../lib/store'
import { encode } from '../lib/morse'
import { engine } from '../lib/audio'
import { Modal, Tip } from '../components/Ui'
import { Play, Download, Trash, Info, Sun, Moon, Volume, Settings as Cog, Refresh } from '../components/Icons'
import { formatDuration } from '../lib/format'

const PRESETS = [
  { label: 'First week', char: 18, eff: 8 },
  { label: 'Comfortable', char: 20, eff: 12 },
  { label: 'Conversational', char: 22, eff: 16 },
  { label: 'On air', char: 25, eff: 20 },
  { label: 'Head copy', char: 30, eff: 25 },
]

export function SettingsScreen() {
  const { settings, progress } = useStore()
  const { showToast } = useApp()
  const [confirm, setConfirm] = useState(false)
  const [testPlaying, setTestPlaying] = useState(false)
  const fileRef = useRef(null)

  const set = (patch) => store.setSettings(patch)

  const updateSpeeds = (char, eff) => {
    const c = Math.max(10, Math.min(35, char))
    const e = Math.max(5, Math.min(c, eff))
    set({ charWpm: c, effWpm: e })
  }

  const test = () => {
    if (testPlaying) {
      engine.stop()
      setTestPlaying(false)
      return
    }
    engine.ensure()
    engine.configure({ freq: settings.freq, volume: settings.volume, wave: settings.wave })
    setTestPlaying(true)
    const handle = engine.play(encode('PARIS'), { charWpm: settings.charWpm, effWpm: settings.effWpm })
    handle.promise.then(() => setTestPlaying(false))
  }

  const exportData = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `morse-studio-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Progress exported')
  }

  const importData = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const ok = store.importJSON(String(reader.result))
      showToast(ok ? 'Progress imported' : 'That file could not be read')
    }
    reader.readAsText(file)
  }

  return (
    <>
      <div className="screen-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1 className="display">Tune the<br />station.</h1>
          <p className="lede">
            Sound, speed and spacing. The defaults are deliberately conservative — a fast
            character speed with generous gaps is what makes Morse stick.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card card-pad">
          <div className="card-head">
            <div className="card-title">Audio</div>
            <Volume width={16} height={16} className="gold" />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Tone</div>
              <div className="setting-sub">Most operators copy best between 550 and 700 Hz. A pure sine is easiest on the ear.</div>
            </div>
            <div className="setting-control wide">
              <input
                type="range" min="350" max="950" step="10" value={settings.freq}
                style={{ '--fill': `${((settings.freq - 350) / 600) * 100}%` }}
                onChange={(e) => set({ freq: Number(e.target.value) })}
                aria-label="Tone frequency"
              />
              <span className="value-pill">{settings.freq}<span>Hz</span></span>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Volume</div>
              <div className="setting-sub">Comfortable, not loud. Long sessions at high volume are tiring.</div>
            </div>
            <div className="setting-control wide">
              <input
                type="range" min="0" max="100" step="1" value={Math.round(settings.volume * 100)}
                style={{ '--fill': `${settings.volume * 100}%` }}
                onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
                aria-label="Volume"
              />
              <span className="value-pill">{Math.round(settings.volume * 100)}<span>%</span></span>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Waveform</div>
              <div className="setting-sub">Sine is standard. Triangle has a little more bite on small speakers.</div>
            </div>
            <div className="setting-control">
              <div className="segmented">
                <button type="button" className={settings.wave === 'sine' ? 'active' : ''} onClick={() => set({ wave: 'sine' })}>Sine</button>
                <button type="button" className={settings.wave === 'triangle' ? 'active' : ''} onClick={() => set({ wave: 'triangle' })}>Triangle</button>
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Test the tone</div>
              <div className="setting-sub">Sends PARIS at your current speeds.</div>
            </div>
            <button type="button" className={`btn ${testPlaying ? 'gold-ghost' : ''}`} onClick={test}>
              <Play width={14} height={14} /> {testPlaying ? 'Stop' : 'Play test'}
            </button>
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <div className="card-title">Speed &amp; spacing</div>
            <Cog width={16} height={16} className="gold" />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Character speed</div>
              <div className="setting-sub">How fast each letter is sent. Keep this at least 18 wpm, even as a beginner.</div>
            </div>
            <div className="setting-control wide">
              <input
                type="range" min="10" max="35" step="1" value={settings.charWpm}
                style={{ '--fill': `${((settings.charWpm - 10) / 25) * 100}%` }}
                onChange={(e) => updateSpeeds(Number(e.target.value), settings.effWpm)}
                aria-label="Character speed"
              />
              <span className="value-pill">{settings.charWpm}<span>wpm</span></span>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Effective speed</div>
              <div className="setting-sub">Farnsworth spacing stretches the gaps between letters so you can decode. This is the speed you actually copy.</div>
            </div>
            <div className="setting-control wide">
              <input
                type="range" min="5" max={settings.charWpm} step="1" value={Math.min(settings.effWpm, settings.charWpm)}
                style={{ '--fill': `${((settings.effWpm - 5) / Math.max(1, settings.charWpm - 5)) * 100}%` }}
                onChange={(e) => updateSpeeds(settings.charWpm, Number(e.target.value))}
                aria-label="Effective speed"
              />
              <span className="value-pill">{settings.effWpm}<span>wpm</span></span>
            </div>
          </div>

          <div style={{ padding: '10px 0 4px' }}>
            <div className="field-cap" style={{ marginBottom: 8 }}>Presets</div>
            <div className="speed-ladder">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`ladder-step ${settings.charWpm === p.char && settings.effWpm === p.eff ? 'active' : ''}`}
                  onClick={() => updateSpeeds(p.char, p.eff)}
                >
                  {p.label} <span style={{ opacity: 0.55 }}>{p.eff}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tip" style={{ marginTop: 12 }}>
            <Info width={15} height={15} />
            <div><b>Raise spacing, not letters.</b> When copy feels easy, nudge effective speed up by 2 wpm. Keep character speed fixed.</div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <div className="card-title">Learning</div>
            <Sun width={16} height={16} className="gold" />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Default keyer</div>
              <div className="setting-sub">Used by the sending screen.</div>
            </div>
            <div className="segmented">
              <button type="button" className={settings.keyer === 'paddle' ? 'active' : ''} onClick={() => set({ keyer: 'paddle' })}>Paddle</button>
              <button type="button" className={settings.keyer === 'straight' ? 'active' : ''} onClick={() => set({ keyer: 'straight' })}>Straight</button>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Show patterns by default</div>
              <div className="setting-sub">Reveals dot-and-dash pictures while learning. Off is better for ear training.</div>
            </div>
            <button
              type="button"
              className={`toggle ${settings.showPatterns ? 'on' : ''}`}
              role="switch"
              aria-checked={settings.showPatterns}
              aria-label="Show patterns by default"
              onClick={() => set({ showPatterns: !settings.showPatterns })}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Setup</div>
              <div className="setting-sub">Re-run the welcome questions to change your path and starting speed.</div>
            </div>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => store.update((s) => ({ ...s, progress: { ...s.progress, onboarded: false } }))}
            >
              Re-run setup
            </button>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Theme</div>
              <div className="setting-sub">Dark for night shifts, paper for daylight.</div>
            </div>
            <div className="segmented">
              <button type="button" className={settings.theme === 'dark' ? 'active' : ''} onClick={() => set({ theme: 'dark' })}>
                <Moon width={12} height={12} style={{ marginRight: 5, verticalAlign: '-1px' }} />Dark
              </button>
              <button type="button" className={settings.theme === 'light' ? 'active' : ''} onClick={() => set({ theme: 'light' })}>
                <Sun width={12} height={12} style={{ marginRight: 5, verticalAlign: '-1px' }} />Light
              </button>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <div className="card-title">Your data</div>
            <span className="chip">{progress.sessions.length} sessions</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            Progress lives in this browser only — no account, no sync. Export a JSON file if you
            want a backup or want to move to another device.
          </p>
          <div className="stack" style={{ gap: 10, marginTop: 16 }}>
            <div className="between" style={{ fontSize: 12, color: 'var(--muted)' }}>
              <span>Practice time</span>
              <span className="mono">{formatDuration(progress.totalPracticeMs)}</span>
            </div>
            <div className="between" style={{ fontSize: 12, color: 'var(--muted)' }}>
              <span>Characters tracked</span>
              <span className="mono">{Object.keys(progress.chars).length}</span>
            </div>
          </div>
          <hr className="divider" />
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn" onClick={exportData}>
              <Download width={14} height={14} /> Export
            </button>
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
              <Refresh width={14} height={14} /> Import
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => importData(e.target.files?.[0])} />
            <button type="button" className="btn ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirm(true)}>
              <Trash width={14} height={14} /> Reset
            </button>
          </div>
        </section>
      </div>

      <section className="card card-pad" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>About the method</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
            <b>Koch method.</b> Two new characters at a time, always mixed with old ones. A pass
            needs 90% accuracy — the curriculum unlocks only when the ear is ready.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
            <b>Farnsworth spacing.</b> Letters are sent fast, but the silence between them is
            stretched. You learn the true sound of the character while giving yourself time to
            decode.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
            <b>PARIS timing.</b> A dot is one unit, a dash three. The word PARIS, with its gaps,
            is exactly 50 units — that is what “words per minute” means here.
          </p>
        </div>
      </section>

      {confirm && (
        <Modal narrow onClose={() => setConfirm(false)} labelledBy="reset-title">
          <div className="eyebrow">Irreversible</div>
          <h2 id="reset-title" className="h2" style={{ marginTop: 10 }}>Reset everything?</h2>
          <p className="dim" style={{ marginTop: 8, fontSize: 13 }}>
            This clears lessons, character stats, sessions and your streak. Export first if you
            want a copy.
          </p>
          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
            <button type="button" className="btn" style={{ background: 'var(--red)', borderColor: 'transparent', color: '#fff' }} onClick={() => { store.reset(); setConfirm(false); showToast('Everything reset') }}>
              <Trash width={14} height={14} /> Reset all
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
