import React, { useMemo } from 'react'
import { useApp } from '../lib/appContext'
import { useStore, knownChars, bestCopySpeed, accuracyAverage, charAccuracy } from '../lib/store'
import { KOCH_ORDER, MORSE, charLabel } from '../lib/morse'
import { useCw } from '../hooks/useCw'
import { Ring, Pattern, Stat } from '../components/Ui'
import { Chart, Clock, Target, Trophy, Spark, ArrowRight, Flame, Book } from '../components/Icons'
import { pct, formatDuration, lastNDays, dayKey, shortDate } from '../lib/format'

export function Progress() {
  const { progress, settings } = useStore()
  const { navigate } = useApp()
  const known = knownChars(progress)
  const best = bestCopySpeed(progress)
  const acc = accuracyAverage(progress, 12)
  const cw = useCw({ charWpm: settings.charWpm, effWpm: settings.charWpm })

  const days = useMemo(() => lastNDays(14).map((d) => {
    const key = dayKey(d)
    const sessions = progress.sessions.filter((s) => dayKey(s.date) === key)
    return {
      date: d,
      ms: sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0),
      accuracy: sessions.length ? sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length : null,
      today: key === dayKey(new Date()),
    }
  }), [progress.sessions])
  const maxMs = Math.max(60000, ...days.map((d) => d.ms))
  const totalMinutes = Math.round(progress.totalPracticeMs / 60000)

  const accuracies = progress.sessions.slice(-24).map((s) => s.accuracy)
  const chartW = 480
  const chartH = 90
  const linePoints = accuracies.map((v, i) => {
    const x = accuracies.length > 1 ? (i / (accuracies.length - 1)) * chartW : 0
    const y = chartH - 6 - v * (chartH - 12)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const recent = [...progress.sessions].reverse().slice(0, 10)

  return (
    <>
      <div className="screen-head">
        <div>
          <div className="eyebrow">Progress</div>
          <h1 className="display">The long<br />game.</h1>
          <p className="lede">
            Morse rewards consistency more than intensity. This is the honest record — every
            session, every weak letter, every speed you have actually copied.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => navigate('learn')}>
          Back to curriculum <ArrowRight width={15} height={15} />
        </button>
      </div>

      <div className="stat-grid">
        <Stat label="Unlocked" value={known.length} unit="/ 40" icon={<Book width={15} height={15} />} foot={`${Object.keys(progress.completed).length} lessons passed`} accent />
        <Stat label="Practice time" value={totalMinutes} unit="min" icon={<Clock width={15} height={15} />} foot={`${progress.sessions.length} sessions logged`} />
        <Stat label="Best copy" value={best || '—'} unit={best ? 'wpm' : ''} icon={<Target width={15} height={15} />} foot={`accuracy ${acc == null ? '—' : pct(acc)} recent`} />
        <Stat label="Streak" value={progress.streak.count} unit="days" icon={<Flame width={15} height={15} />} foot={progress.sessions.length ? `last session ${shortDate(progress.sessions[progress.sessions.length - 1].date)}` : 'start today'} />
      </div>

      <div className="dash-grid">
        <section className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-title">Accuracy over time</div>
              <div className="card-cap" style={{ marginTop: 4 }}>Last {Math.min(24, progress.sessions.length) || 0} sessions</div>
            </div>
            <Spark width={16} height={16} className="gold" />
          </div>
          {accuracies.length > 1 ? (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} preserveAspectRatio="none" role="img" aria-label="Accuracy trend">
              <defs>
                <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,${chartH} ${linePoints} ${chartW},${chartH}`} fill="url(#accFill)" />
              <polyline points={linePoints} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="0" y1={chartH - 6 - 0.9 * (chartH - 12)} x2={chartW} y2={chartH - 6 - 0.9 * (chartH - 12)} stroke="var(--line-strong)" strokeDasharray="4 5" strokeWidth="1" />
            </svg>
          ) : (
            <div className="empty">Two sessions and this chart starts telling you something.</div>
          )}
          <div className="between" style={{ marginTop: 10, fontSize: 10.5, color: 'var(--muted)' }}>
            <span className="mono">OLDEST</span>
            <span>dashed line = 90% pass mark</span>
            <span className="mono">LATEST</span>
          </div>

          <hr className="divider" />

          <div className="card-title" style={{ marginBottom: 12 }}>Practice — last 14 days</div>
          <div className="week-chart" style={{ height: 110 }} role="img" aria-label="Practice minutes over the last fourteen days">
            {days.map((d, i) => (
              <div className={`week-col ${d.today ? 'today' : ''}`} key={i}>
                <div
                  className="week-bar"
                  style={{ height: `${d.ms ? Math.max(6, (d.ms / maxMs) * 100) : 3}%` }}
                  title={`${d.date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${Math.round(d.ms / 60000)} min`}
                />
                <span className="week-day">{d.date.toLocaleDateString([], { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-title">Curriculum</div>
              <div className="card-cap" style={{ marginTop: 4 }}>Koch order</div>
            </div>
            <Ring value={known.length / 40} size={78} stroke={4}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 15 }}>{known.length}<span style={{ fontSize: 9, color: 'var(--muted)' }}>/40</span></div>
            </Ring>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <div className="between" style={{ fontSize: 12 }}>
              <span className="muted">Current lesson</span>
              <span className="mono">{String(progress.lesson).padStart(2, '0')} / 20</span>
            </div>
            <div className="between" style={{ fontSize: 12 }}>
              <span className="muted">Lessons passed</span>
              <span className="mono">{Object.keys(progress.completed).length} / 20</span>
            </div>
            <div className="between" style={{ fontSize: 12 }}>
              <span className="muted">Last session</span>
              <span className="mono">{progress.sessions.length ? shortDate(progress.sessions[progress.sessions.length - 1].date) : '—'}</span>
            </div>
          </div>
          <hr className="divider" />
          <div className="card-cap" style={{ marginBottom: 8 }}>Recent sessions</div>
          {recent.length ? (
            <table className="session-table">
              <thead>
                <tr><th>When</th><th>Type</th><th>Acc</th><th>Speed</th></tr>
              </thead>
              <tbody>
                {recent.slice(0, 6).map((s) => (
                  <tr key={s.id}>
                    <td>{shortDate(s.date)}</td>
                    <td><span className="session-kind">{s.kind === 'send' ? 'Key' : s.kind === 'copy' ? 'Copy' : 'Drill'}</span></td>
                    <td className={`acc ${s.accuracy >= 0.9 ? 'good' : s.accuracy >= 0.7 ? 'mid' : 'bad'}`}>{pct(s.accuracy)}</td>
                    <td className="num">{s.wpm ? `${s.wpm}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No sessions yet.</div>
          )}
        </section>
      </div>

      <section className="card card-pad" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Per-character signal report</div>
            <div className="card-cap" style={{ marginTop: 4 }}>All forty characters · click to hear</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip mint">≥ 92%</span>
            <span className="chip gold">75–92%</span>
            <span className="chip red">&lt; 75%</span>
          </div>
        </div>
        <div className="heatmap-grid">
          {KOCH_ORDER.map((char) => {
            const entry = progress.chars[char]
            const acc = charAccuracy(entry)
            const inSet = known.includes(char)
            const color = acc == null ? 'var(--line)' : acc >= 0.92 ? 'var(--mint)' : acc >= 0.75 ? 'var(--gold)' : 'var(--red)'
            return (
              <button
                key={char}
                type="button"
                className="hm-cell"
                style={{ opacity: inSet ? 1 : 0.4, cursor: inSet ? 'pointer' : 'default' }}
                onClick={() => inSet && cw.play(MORSE[char], { charWpm: settings.charWpm, effWpm: settings.charWpm })}
                title={inSet ? `Hear ${charLabel(char)}` : 'Not unlocked yet'}
              >
                <span className="ch">{char}<small>{entry?.shown || 0}</small></span>
                <span className="hm-bar"><i style={{ width: `${(acc ?? 0) * 100}%`, background: color }} /></span>
                <span className="pct">{acc == null ? (inSet ? 'not drilled' : 'locked') : pct(acc)}</span>
              </button>
            )
          })}
        </div>
        <div className="tip" style={{ marginTop: 16 }}>
          <Trophy width={15} height={15} />
          <div><b>How to read this:</b> accuracy above 92% at your current speed means the character is solid. Below 75% and it should appear in almost every drill — the adaptive engine already handles that.</div>
        </div>
      </section>
    </>
  )
}
