import React, { useEffect, useState } from 'react'
import { Test } from './screens/Test'
import { Codes } from './screens/Codes'

const ROUTES = { test: Test, codes: Codes }
const TITLES = { test: 'Random test', codes: 'Morse codes' }
const TABS = [
  { id: 'test', label: 'Test' },
  { id: 'codes', label: 'Morse codes' },
]

function readRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return ROUTES[hash] ? hash : 'test'
}

export default function App() {
  const [route, setRoute] = useState(readRoute)

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.history.replaceState(null, '', '#/test')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${TITLES[route]} · Morse Studio`
  }, [route])

  const Screen = ROUTES[route] || Test

  return (
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="#/test" onClick={() => setRoute('test')}>
            <span className="brand-mark" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="12" r="2" fill="currentColor" />
                <rect x="10" y="10" width="12" height="4" rx="2" fill="currentColor" />
              </svg>
            </span>
            <span className="brand-name">Morse Studio</span>
          </a>

          <nav className="tabs" aria-label="Sections">
            {TABS.map((tab) => (
              <a
                key={tab.id}
                className={`tab ${route === tab.id ? 'active' : ''}`}
                href={`#/${tab.id}`}
                aria-current={route === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap">
        <Screen />
        <p className="foot">
          Morse is a sound language — learn the rhythm, not a picture of dots and dashes.
        </p>
      </main>
    </div>
  )
}
