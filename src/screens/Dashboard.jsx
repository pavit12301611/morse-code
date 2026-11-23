import React, { useMemo, useState } from 'react'
import { useApp } from '../lib/appContext'
import { useStore, knownChars, weakestChars, bestCopySpeed, accuracyAverage, todaySessions } from '../lib/store'
import { buildLessons, encode, charLabel, MORSE } from '../lib/morse'
import { useCw } from '../hooks/useCw'
import { Lamp, Tape, Stat, Sparkline } from '../components/Ui'
import { ArrowRight, Play, Pause, Ear, Clock, Headphones, Target, Book, Check, Flame, Spark } from '../components/Icons'
import { pct, formatDuration, dayKey, lastNDays } from '../lib/format'

const lessons = buildLessons(2)

export function Dashboard() {
  const { progress, settings } = useStore()
  const { navigate, launchDrill } = useApp()
  const known = knownChars(progress)
  const lesson = lessons[Math.min(lessons.length - 1, (progress.lesson || 1) - 1)]
  const firstUnfinished = lessons.find((l) => !progress.completed[l.id])
  const nextLesson = progress.completed[lesson.id] && firstUnfinished ? firstUnfinished : lesson
  const weak = useMemo(() => weakestChars(progress, known, 5), [progress, known])
  const best = bestCopySpeed(progress)
  const acc = accuracyAverage(progress, 12)
  const today = todaySessions(progress)
  const todayMinutes = today.reduce((s, x) => s + x.durationMs, 0)

  const firstRun = progress.sessions.length === 0
  const sampleText = 'MORSE'
  const sampleCode = encode(sampleText)
  const cw = useCw({ charWpm: settings.charWpm, effWpm: settings.charWpm })
  const [samplePlaying, setSamplePlaying] = useState(false)

  const playSample = () => {
    if (samplePlaying) {
      cw.stop()
      setSamplePlaying(false)
      return
    }
    setSamplePlaying(true)
    cw.play(sampleCode, { charWpm: 20, effWpm: 20, onEnd: () => setSamplePlaying(false) })
  }

  const lessonChars = nextLesson.chars
  const sessionDone = { drill: false, copy: false, send: false }
  today.forEach((s) => { sessionDone[s.kind] = true })

  const week = lastNDays(7).map((d) => {
    const k = dayKey(d)
    const ms = progress.sessions.filter((s) => dayKey(s.date) === k).reduce((sum, s) => sum + (s.durationMs || 0), 0)
    return { day: d.toLocaleDateString([], { weekday: 'narrow' }), ms, today: k === dayKey(new Date()) }
  })
  const weekMax = Math.max(60000, ...week.map((w) => w.ms))
  const weekMinutes = Math.round(week.reduce((s, w) => s + w.ms, 0) / 60000)

  const accuracySpark = progress.sessions.slice(-10).map((s) => s.accuracy)
  const plan = [
    {
      key: 'drill',
      title: 'Recognition drill',
      sub: `${known.length} characters · 20 reps · adaptive`,
      done: sessionDone.drill,
      action: () => launchDrill({ source: 'known', chars: known, mode: 'char', count: 20 }),
      cta: 'Start',
    },
    {
      key: 'learn',
      title: `Learn ${lessonChars.join(' ')}`,
      sub: `Lesson ${nextLesson.id} of ${lessons.length} · by ear`,
      done: !!progress.completed[nextLesson.id],
      action: () => navigate('learn'),
      cta: progress.completed[nextLesson.id] ? 'Review' : 'Open',
    },
    {
      key: 'copy',
      title: 'Head copy',
      sub: '5-character groups · one pass only',
      done: sessionDone.copy,
      action: () => navigate('copy'),
      cta: 'Copy',
    },
    {
      key: 'send',
      title: 'Sending practice',
      sub: settings.keyer === 'paddle' ? 'Paddle keyer · rhythm score' : 'Straight key · timing score',
      done: sessionDone.send,
      action: () => navigate('send'),
      cta: 'Key',
    },
  ]

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Lesson {String(progress.lesson).padStart(2, '0')} · {known.slice(-2).join(' ')} unlocked</div>
          <h1 className="display">Hear the rhythm.<br />Read at <em>speed</em>.</h1>
          <p>
            Morse is a sound language, not a puzzle of dots. Train your ear with real
            CW timing, adaptive reps and a key you can actually send on.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn primary lg"
              onClick={() => (firstRun ? navigate('learn') : launchDrill({ source: 'known', chars: known, mode: 'char', count: 20 }))}
            >
              {firstRun ? 'Start your first lesson' : 'Start today’s session'} <ArrowRight width={16} height={16} />
            </button>
            <button type="button" className="btn ghost lg" onClick={playSample}>
              {samplePlaying ? <Pause width={15} height={15} /> : <Play width={15} height={15} />}
              {samplePlaying ? 'Playing sample' : 'Hear a sample'}
            </button>
          </div>
          <div className="hero-meta">
            <span>CHAR SPEED <b>{settings.charWpm} wpm</b></span>
            <span>EFFECTIVE <b>{settings.effWpm} wpm</b></span>
            <span>METHOD <b>Koch + Farnsworth</b></span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="lamp-scene">
            <span className="lamp-ring ring-2" />
            <span className="lamp-ring ring-3" />
            <Lamp on={samplePlaying && cw.tone} />
          </div>
          <div className="hero-tape" aria-hidden="true">
            <Tape code={sampleCode} eventIndex={cw.eventIndex} tone={cw.tone} />
          </div>
          <div className="hint-line" style={{ marginTop: 14 }}>
            {samplePlaying ? `Receiving “${sampleText}”` : 'Sample · MORSE at 20 wpm'}
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <Stat
          label="Characters"
          value={known.length}
          unit="/ 40"
          icon={<Book width={15} height={15} />}
          foot={<>{progress.completed && Object.keys(progress.completed).length} lessons passed</>}
          accent
        />
        <Stat
          label="Best copy"
          value={best || '—'}
          unit={best ? 'wpm' : ''}
          icon={<Target width={15} height={15} />}
          foot={<>at {settings.charWpm} wpm character speed</>}
        />
        <Stat
          label="Recent accuracy"
          value={acc == null ? '—' : pct(acc)}
          icon={<Spark width={15} height={15} />}
          foot={<><Sparkline values={accuracySpark.length > 1 ? accuracySpark : [0.5, 0.6]} width={62} height={18} />last {Math.min(12, progress.sessions.length) || 0} sessions</>}
        />
        <Stat
          label="Streak"
          value={progress.streak.count}
          unit="days"
          icon={<Flame width={15} height={15} />}
          foot={<>{todayMinutes ? `${formatDuration(todayMinutes)} today` : 'A short session counts'}</>}
        />
      </div>

      <div className="dash-grid">
        <section className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-title">Today’s session</div>
              <div className="card-cap" style={{ marginTop: 4 }}>{today.length ? `${today.length} practice block${today.length > 1 ? 's' : ''} logged · ${formatDuration(todayMinutes)}` : 'About 12 focused minutes'}</div>
            </div>
            <span className={`chip ${today.length >= 3 ? 'mint' : 'gold'}`}>{today.length >= 3 ? 'Complete' : 'In progress'}</span>
          </div>
          {plan.map((item, i) => (
            <div className={`plan-item ${item.done ? 'done' : i === 0 ? 'active' : ''}`} key={item.key}>
              <div className="plan-num">{item.done ? <Check width={14} height={14} /> : String(i + 1).padStart(2, '0')}</div>
              <div className="plan-body">
                <div className="plan-title">{item.title}</div>
                <div className="plan-sub">{item.sub}</div>
              </div>
              <button type="button" className={`btn sm ${i === 0 && !item.done ? 'gold-ghost' : 'ghost'}`} onClick={item.action}>
                {item.cta} <ArrowRight width={13} height={13} />
              </button>
            </div>
          ))}
        </section>

        <div className="stack">
          <section className="card card-pad">
            <div className="card-head">
              <div>
                <div className="card-title">Signal report</div>
                <div className="card-cap" style={{ marginTop: 4 }}>Characters to revisit</div>
              </div>
              <span className="chip gold">Adaptive</span>
            </div>
            {weak.length ? (
              <div className="weak-list">
                {weak.map((w) => (
                  <div className="weak-row" key={w.char}>
                    <button
                      type="button"
                      className="weak-char"
                      title={`Hear ${charLabel(w.char)}`}
                      onClick={() => cw.play(MORSE[w.char], { charWpm: settings.charWpm, effWpm: settings.charWpm })}
                    >
                      {w.char === ' ' ? '·' : w.char}
                    </button>
                    <div>
                      <div className="weak-bar"><i style={{ width: `${Math.max(4, (w.acc ?? 0) * 100)}%` }} /></div>
                      <div className="plan-sub" style={{ marginTop: 5 }}>{w.shown} reps · {w.avgMs ? `${Math.round(w.avgMs)} ms` : 'timing —'}</div>
                    </div>
                    <span className={`weak-val ${w.acc < 0.7 ? 'red' : w.acc < 0.9 ? 'gold' : 'mint'}`}>{pct(w.acc)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                No signal report yet. Finish a drill and the studio will start tracking which letters need work.
              </div>
            )}
            <button
              type="button"
              className="btn ghost sm"
              style={{ width: '100%', marginTop: 16 }}
              disabled={!weak.length}
              onClick={() => launchDrill({ source: 'weak', chars: weak.map((w) => w.char), mode: 'char', count: 20 })}
            >
              Drill my weak letters <ArrowRight width={13} height={13} />
            </button>
          </section>

          <section className="card card-pad">
            <div className="between">
              <div>
                <div className="card-title">This week</div>
                <div className="card-cap" style={{ marginTop: 4 }}>{weekMinutes ? `${weekMinutes} minutes logged` : 'No practice logged yet'}</div>
              </div>
              <Clock width={16} height={16} className="muted" />
            </div>
            <div className="week-chart" role="img" aria-label={`Practice time over the last seven days, ${weekMinutes} minutes total`}>
              {week.map((w, i) => (
                <div className={`week-col ${w.today ? 'today' : ''}`} key={i}>
                  <div className="week-bar" style={{ height: `${w.ms ? Math.max(8, (w.ms / weekMax) * 100) : 3}%` }} title={`${Math.round(w.ms / 60000)} min`} />
                  <span className="week-day">{w.day}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="method-strip">
        <div className="method">
          <span className="method-ico"><Ear width={16} height={16} /></span>
          <div>
            <h4>By ear, never by eye</h4>
            <p>Patterns are available, but they are not the lesson. You learn the sound, then the letter.</p>
          </div>
        </div>
        <div className="method">
          <span className="method-ico"><Target width={16} height={16} /></span>
          <div>
            <h4>Fast letters, wide gaps</h4>
            <p>Characters arrive at real speed while Farnsworth spacing gives your brain room to decode.</p>
          </div>
        </div>
        <div className="method">
          <span className="method-ico"><Headphones width={16} height={16} /></span>
          <div>
            <h4>Ten minutes, daily</h4>
            <p>Short sessions beat marathon cramming. The adaptive engine re-serves whatever you miss.</p>
          </div>
        </div>
      </div>
    </>
  )
}
