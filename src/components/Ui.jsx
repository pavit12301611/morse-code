import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Close, Play, Pause } from './Icons'

export function Pattern({ code = '', size = 'md', tone = 'default', className = '' }) {
  const cls = `pattern ${size === 'lg' ? 'lg' : ''} ${tone === 'gold' ? 'golden' : ''} ${className}`
  return (
    <span className={cls} aria-label={code.replace(/\./g, 'dit ').replace(/-/g, 'dah ')}>
      {[...code].map((s, i) => (
        <i key={i} className={s === '-' ? 'h' : 'd'} />
      ))}
    </span>
  )
}

export function Ring({ value = 0, size = 116, stroke = 5, color = 'var(--gold)', track = 'var(--line)', children, className = '' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value || 0))
  return (
    <div className={`big-ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)', filter: 'drop-shadow(0 0 6px rgba(246,189,107,.35))' }}
        />
      </svg>
      {children != null && <div className="inner">{children}</div>}
    </div>
  )
}

export function Lamp({ on = false, big = false, label }) {
  return (
    <div className="lamp-wrap">
      <div className={`lamp ${big ? 'big' : ''} ${on ? 'on' : ''}`} role="img" aria-label={on ? 'Tone on' : 'Tone off'}>
        <div className="lamp-core" />
      </div>
      {label && <div className="lamp-label">{label}</div>}
    </div>
  )
}

export function PlayButton({ playing, onClick, size = 'md', title = 'Play' }) {
  return (
    <button
      type="button"
      className={`btn ${size === 'sm' ? 'sm' : ''} ${playing ? 'gold-ghost' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={playing ? 'Stop' : title}
    >
      {playing ? <Pause width={14} height={14} /> : <Play width={14} height={14} />}
      {size !== 'icon' && <span>{playing ? 'Stop' : 'Play'}</span>}
    </button>
  )
}

/** Dots and dashes for a whole code string, with a live playhead. */
export function Tape({ code = '', eventIndex = -1, tone = false, className = '' }) {
  let flat = 0
  const chunks = code.split(' ')
  return (
    <div className={`tape ${className}`} aria-hidden="true">
      {chunks.map((chunk, ci) => {
        if (chunk === '/') return <span key={ci} className="letter-sep" />
        return (
          <React.Fragment key={ci}>
            {ci > 0 && chunks[ci - 1] !== '/' && <span className="tape-gap" />}
            {[...chunk].map((sym, ei) => {
              const idx = flat
              flat += 1
              const isOn = idx === eventIndex && tone
              const isDone = idx < eventIndex
              return <span key={ei} className={`el ${sym === '-' ? 'h' : 'd'} ${isOn ? 'on' : ''} ${isDone ? 'done' : ''}`} />
            })}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export function Modal({ children, onClose, narrow = false, labelledBy }) {
  useEffect(() => {
    if (!onClose) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {onClose && (
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <Close width={16} height={16} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Toast({ children }) {
  if (!children) return null
  return <div className="toast" role="status">{children}</div>
}

export function Stat({ icon, label, value, unit, foot, accent }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="card-cap">{label}</span>
        {icon && <span className={`stat-icon ${accent ? 'gold' : ''}`}>{icon}</span>}
      </div>
      <div className="stat-val">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  )
}

export function Tip({ children, icon }) {
  return (
    <div className="tip">
      {icon}
      <div>{children}</div>
    </div>
  )
}

export function Sparkline({ values = [], width = 78, height = 22, color = 'var(--gold)' }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 0.001)
  const min = Math.min(...values)
  const span = Math.max(0.001, max - min)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - 2 - ((v - min) / span) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg width={width} height={height} className="stat-spark" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
