import React, { useState } from 'react'
import { useApp } from '../lib/appContext'
import { store, useStore, knownChars } from '../lib/store'
import { buildLessons, MORSE, charLabel, rhythm } from '../lib/morse'
import { useCw } from '../hooks/useCw'
import { Modal, Pattern, Ring, Tip } from '../components/Ui'
import { Play, Pause, ArrowRight, Lock, Check, Ear, Info, Book, Spark } from '../components/Icons'
import { pct } from '../lib/format'

const lessons = buildLessons(2)

export function Learn() {
  const { progress, settings } = useStore()
  const { launchDrill, showToast } = useApp()
  const known = knownChars(progress)
  const [openLesson, setOpenLesson] = useState(null)
  const [revealed, setRevealed] = useState({})
  const cw = useCw({ charWpm: settings.charWpm, effWpm: settings.effWpm })

  const completedCount = Object.keys(progress.completed || {}).length
  const current = lessons[Math.min(lessons.length - 1, progress.lesson - 1)]
  const selected = openLesson ? lessons.find((l) => l.id === openLesson) : null
  const isLocked = (lesson) => lesson.id > progress.lesson

  const open = (lesson) => {
    if (isLocked(lesson)) {
      showToast(`Lesson ${lesson.id} unlocks after lesson ${lesson.id - 1}`)
      return
    }
    setRevealed({})
    setOpenLesson(lesson.id)
  }

  const playChar = (char, slow = false) => {
    cw.play(MORSE[char], {
      charWpm: slow ? Math.max(10, settings.charWpm - 6) : settings.charWpm,
      effWpm: slow ? Math.max(8, settings.charWpm - 6) : settings.charWpm,
    })
  }

  const repeatChar = (char) => {
    cw.play(Array(5).fill(MORSE[char]).join(' / '), {
      charWpm: settings.charWpm,
      effWpm: Math.min(settings.effWpm, settings.charWpm),
    })
  }

  const startLesson = () => {
    if (!selected) return
    setOpenLesson(null)
    launchDrill({
      source: 'lesson',
      lessonId: selected.id,
      chars: [...selected.previous.slice(-6), ...selected.chars],
      mode: 'char',
      count: 24,
    })
  }

  return (
    <>
      <div className="screen-head">
        <div>
          <div className="eyebrow">Curriculum · Koch method</div>
          <h1 className="display">Forty characters.<br />Twenty short lessons.</h1>
          <p className="lede">
            Two new letters at a time, mixed with everything you already know. A lesson
            passes at 90% — the studio will not let you rush ahead of your ear.
          </p>
        </div>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 250 }}>
          <Ring value={completedCount / lessons.length} size={92} stroke={4}>
            <div className="v" style={{ fontFamily: 'var(--mono)', fontSize: 18, lineHeight: 1 }}>{completedCount}<span style={{ fontSize: 10, color: 'var(--muted)' }}>/20</span></div>
            <div className="k">lessons</div>
          </Ring>
          <div>
            <div className="card-cap">Unlocked</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, marginTop: 4 }}>{known.length}<span style={{ fontSize: 11, color: 'var(--muted)' }}> / 40</span></div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>characters in rotation</div>
            <button type="button" className="btn sm gold-ghost" style={{ marginTop: 12 }} onClick={() => open(current)}>
              {progress.completed[current.id] ? 'Review lesson' : 'Start lesson'} {current.id} <ArrowRight width={12} height={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="tip" style={{ marginBottom: 18 }}>
        <Ear width={16} height={16} />
        <div>
          <b>Read this twice.</b> Every character is introduced as a sound first. Listen to it ten
          times, say its rhythm out loud, then drill it. The dot-dash picture stays hidden unless
          you ask for it — cheap visual memory does not survive real speed.
        </div>
      </div>

      <div className="lesson-grid">
        {lessons.map((lesson) => {
          const done = progress.completed?.[lesson.id]
          const active = lesson.id === progress.lesson
          const locked = isLocked(lesson)
          return (
            <button
              key={lesson.id}
              type="button"
              className={`lesson-card ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => open(lesson)}
              aria-label={`Lesson ${lesson.id}, characters ${lesson.chars.join(' ')}${locked ? ', locked' : ''}`}
            >
              <div className="lesson-no">
                <span>Lesson {String(lesson.id).padStart(2, '0')}</span>
                {done && !done.assumed && <span className="check"><Check width={13} height={13} /></span>}
                {done?.assumed && <span className="check"><Check width={13} height={13} /></span>}
                {locked && <Lock width={12} height={12} />}
              </div>
              <div className="lesson-chars">{lesson.chars.join(' ')}</div>
              <div className="lesson-foot">
                {done ? `Passed · ${pct(done.best ?? done.accuracy)}` : active ? 'Up next' : locked ? 'Locked' : 'Available'}
              </div>
            </button>
          )
        })}
      </div>

      <section className="card card-pad" style={{ marginTop: 18 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Why this order?</div>
            <div className="card-cap" style={{ marginTop: 4 }}>Koch, 1930s</div>
          </div>
          <Spark width={16} height={16} className="gold" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            K and M are not the easiest letters on paper — they are chosen because they sound
            distinct, share a rhythm, and cannot be confused. Learning order follows sound, not
            the alphabet.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            The two newest characters appear often, but never more than a third of a session.
            Review is mixed in from the start, so nothing is learned in isolation.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Once you pass a lesson, it still comes back in drills. Mastery here is a rolling
            average, not a badge you collect once.
          </p>
        </div>
      </section>

      {selected && (
        <Modal onClose={() => { cw.stop(); setOpenLesson(null) }} labelledBy="lesson-title">
          <div className="eyebrow">Lesson {String(selected.id).padStart(2, '0')} · {selected.chars.length} new characters</div>
          <h2 id="lesson-title" className="h2" style={{ marginTop: 10 }}>
            {progress.completed?.[selected.id] ? 'Review' : 'Meet'} {selected.chars.join(' and ')}
          </h2>
          <p className="dim" style={{ fontSize: 13, marginTop: 8, maxWidth: '56ch' }}>
            Listen first. Say the rhythm out loud, then hear it again. When both letters feel
            familiar, drill them with a few old friends mixed in.
          </p>

          <div className="lesson-detail" style={{ marginTop: 22 }}>
            {selected.chars.map((char) => {
              const code = MORSE[char]
              const show = revealed[char] || settings.showPatterns
              return (
                <div className="letter-card" key={char}>
                  <div className="card-cap">{charLabel(char)}</div>
                  <div className="letter-big">{char}</div>
                  <div className="letter-pattern">
                    {show ? <Pattern code={code} size="lg" tone="gold" /> : <span className="muted" style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Pattern hidden</span>}
                  </div>
                  <div className="letter-note">
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-2)' }}>
                      {rhythm(code)}
                    </div>
                    <div style={{ marginTop: 4 }}>Say it as “{rhythm(code).replaceAll(' · ', '-')}”</div>
                  </div>
                  <div className="letter-actions">
                    <button type="button" className="btn sm" onClick={() => playChar(char)}>
                      {cw.playing ? <Pause width={13} height={13} /> : <Play width={13} height={13} />} Hear it
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => playChar(char, true)}>
                      Slow
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => repeatChar(char)}>
                      Repeat ×5
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => setRevealed((r) => ({ ...r, [char]: !r[char] }))}>
                      {show ? 'Hide' : 'Show'} pattern
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {selected.previous.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="field-cap" style={{ marginBottom: 8 }}>In rotation from earlier lessons</div>
              <div className="char-heat">
                {selected.previous.slice(-14).map((char) => (
                  <button key={char} type="button" className="heat-cell" onClick={() => playChar(char)} title={`Hear ${charLabel(char)}`}>
                    {char}
                  </button>
                ))}
              </div>
            </div>
          )}

          <hr className="divider" />
          <div className="between" style={{ gap: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', maxWidth: '34ch' }}>
              {progress.completed?.[selected.id]
                ? `Best score ${pct(progress.completed[selected.id].best ?? progress.completed[selected.id].accuracy)}. A re-drill keeps it sharp.`
                : 'Pass with 90% or better to unlock the next lesson.'}
            </div>
            <button type="button" className="btn primary" onClick={startLesson}>
              Drill lesson {selected.id} <ArrowRight width={15} height={15} />
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
