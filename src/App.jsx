import React, { useCallback, useEffect, useRef, useState } from 'react'
import { engine } from './lib/audio'
import { store, useStore, useThemeEffect } from './lib/store'
import { AppCtx } from './lib/appContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Onboarding } from './components/Onboarding'
import { Toast } from './components/Ui'
import {
  Home, Book, Target, Headphones, KeyIcon, Table, Chart, Settings,
  Volume, VolumeOff, Sun, Moon, Menu, Close, Info,
} from './components/Icons'
import { Dashboard } from './screens/Dashboard'
import { Learn } from './screens/Learn'
import { Drill } from './screens/Drill'
import { Copy } from './screens/Copy'
import { Send } from './screens/Send'
import { Reference } from './screens/Reference'
import { Progress } from './screens/Progress'
import { SettingsScreen } from './screens/Settings'

const NAV = [
  {
    group: 'Practice',
    items: [
      { id: 'home', label: 'Overview', icon: Home },
      { id: 'learn', label: 'Curriculum', icon: Book },
      { id: 'drill', label: 'Recognition drill', icon: Target },
      { id: 'copy', label: 'Head copy', icon: Headphones },
      { id: 'send', label: 'Sending', icon: KeyIcon },
    ],
  },
  {
    group: 'Library',
    items: [
      { id: 'reference', label: 'Signal table', icon: Table },
      { id: 'progress', label: 'Progress', icon: Chart },
    ],
  },
]

const TITLES = {
  home: 'Overview',
  learn: 'Curriculum',
  drill: 'Recognition drill',
  copy: 'Head copy',
  send: 'Sending',
  reference: 'Signal table',
  progress: 'Progress',
  settings: 'Settings',
}

function readRoute() {
  const h = window.location.hash.replace(/^#\/?/, '')
  return TITLES[h] ? h : 'home'
}

export default function App() {
  const state = useStore()
  const { settings, progress } = state
  const [route, setRoute] = useState(readRoute)
  const [drawer, setDrawer] = useState(false)
  const [toast, setToast] = useState(null)
  const [drillConfig, setDrillConfig] = useState(null)
  const [onboard, setOnboard] = useState(!progress.onboarded)
  const toastTimer = useRef(null)
  const lastVolume = useRef(settings.volume || 0.45)

  useThemeEffect()

  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${TITLES[route]} · Morse Studio`
  }, [route])

  useEffect(() => {
    const onHide = () => { if (document.hidden) engine.stop() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useEffect(() => {
    engine.configure({ freq: settings.freq, volume: settings.volume, wave: settings.wave })
  }, [settings.freq, settings.volume, settings.wave])

  // Browsers require a gesture before audio can start.
  useEffect(() => {
    const unlock = () => engine.ensure()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    setOnboard(!progress.onboarded)
  }, [progress.onboarded])

  const navigate = useCallback((next) => {
    if (window.location.hash !== `#/${next}`) window.location.hash = `#/${next}`
    setRoute(next)
    setDrawer(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    engine.stop()
  }, [])

  const showToast = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const launchDrill = useCallback((config) => {
    setDrillConfig(config)
    navigate('drill')
  }, [navigate])

  const toggleMute = () => {
    if (settings.volume > 0) {
      lastVolume.current = settings.volume
      store.setSettings({ volume: 0 })
      showToast('Audio muted')
    } else {
      engine.ensure()
      store.setSettings({ volume: lastVolume.current || 0.45 })
      showToast('Audio on')
    }
  }

  const toggleTheme = () => {
    store.setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
  }

  const screens = {
    home: Dashboard,
    learn: Learn,
    drill: Drill,
    copy: Copy,
    send: Send,
    reference: Reference,
    progress: Progress,
    settings: SettingsScreen,
  }
  const Screen = screens[route] || Dashboard
  const muted = settings.volume === 0

  return (
    <AppCtx.Provider value={{ navigate, launchDrill, drillConfig, setDrillConfig, showToast, route }}>
      <div className="app">
        {drawer && <div className="rail-scrim" onClick={() => setDrawer(false)} />}
        <aside className={`rail ${drawer ? 'open' : ''}`} aria-label="Main navigation">
          <a className="brand" href="#/home" onClick={(e) => { e.preventDefault(); navigate('home') }}>
            <span className="brand-mark" aria-hidden="true">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="12" r="2.1" fill="#f6bd6b" />
                <rect x="10" y="9.9" width="12" height="4.2" rx="2.1" fill="#f6bd6b" />
              </svg>
            </span>
            <span>
              <span className="brand-name">Morse Studio</span>
              <span className="brand-sub">Copy at speed</span>
            </span>
            {drawer && (
              <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setDrawer(false)} aria-label="Close menu">
                <Close width={16} height={16} />
              </button>
            )}
          </a>

          {NAV.map((group) => (
            <nav className="nav" key={group.group} aria-label={group.group}>
              <div className="eyebrow plain nav-label">{group.group}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${route === item.id ? 'active' : ''}`}
                    aria-current={route === item.id ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon width={17} height={17} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          ))}

          <div className="rail-foot">
            <button type="button" className={`nav-item ${route === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>
              <Settings width={17} height={17} />
              <span>Settings</span>
            </button>
            <div className="streak-card">
              <span className="streak-flame">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M12 21c3.9 0 6.5-2.6 6.5-6 0-4.4-4.2-6.2-4.2-10.5-2.3 1-3.3 3-3.3 4.8 0 1.2.4 2.1.4 2.6 0 .9-.8 1.6-1.6 1.6-1 0-1.7-.8-1.7-2.1C6.3 12.6 5.5 14 5.5 15c0 3.4 2.6 6 6.5 6z" />
                </svg>
              </span>
              <div>
                <div className="streak-days">{progress.streak.count}<span style={{ fontSize: 11, color: 'var(--muted)' }}> d</span></div>
                <div className="streak-cap">Current streak</div>
              </div>
            </div>
            <p className="rail-note">
              <b>{progress.lesson * 2}</b> of 40 characters unlocked.<br />
              All progress stays on this device.
            </p>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu width={17} height={17} />
            </button>
            <div className="crumb">
              <span>Studio</span>
              <span className="sep">/</span>
              <b>{TITLES[route]}</b>
            </div>
            <div className="topbar-right">
              <div className="speed-chip" title="Character speed / effective speed">
                <span className="dot" />
                <b>{settings.charWpm}</b> wpm<span style={{ opacity: 0.45 }}>/</span><b>{settings.effWpm}</b>
              </div>
              <button type="button" className={`icon-btn ${muted ? '' : 'on'}`} onClick={toggleMute} aria-label={muted ? 'Unmute audio' : 'Mute audio'} title={muted ? 'Unmute' : 'Mute'}>
                {muted ? <VolumeOff width={16} height={16} /> : <Volume width={16} height={16} />}
              </button>
              <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
                {settings.theme === 'dark' ? <Sun width={16} height={16} /> : <Moon width={16} height={16} />}
              </button>
            </div>
          </header>

          <main>
            <div className="screen" key={route}>
              <ErrorBoundary>
                <Screen />
              </ErrorBoundary>
            </div>
            <footer style={{ padding: '0 34px 34px', maxWidth: 1220, margin: '0 auto', width: '100%' }}>
              <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="eyebrow plain" style={{ letterSpacing: '0.14em' }}>Dit · Dah · Learn by ear</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Timing follows the PARIS standard with Farnsworth spacing.
                </span>
              </div>
            </footer>
          </main>
        </div>
      </div>

      {onboard && <Onboarding onDone={() => setOnboard(false)} />}
      <Toast>{toast && (<><Info width={14} height={14} className="gold" />{toast}</>)}</Toast>
    </AppCtx.Provider>
  )
}
