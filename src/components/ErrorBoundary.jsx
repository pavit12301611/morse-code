import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the console useful in development without crashing the studio.
    console.error('Morse Studio screen error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Signal lost</div>
          <h2 className="h2" style={{ marginTop: 12 }}>Something went off-frequency.</h2>
          <p className="dim" style={{ marginTop: 8, fontSize: 13.5 }}>
            The screen hit an unexpected error. Your progress is safe on this device.
          </p>
          <button type="button" className="btn primary" style={{ marginTop: 20 }} onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
