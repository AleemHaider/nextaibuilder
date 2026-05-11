// Top-level error boundary. A render-time crash anywhere inside (TipTap,
// dnd-kit, chart libs, route components) is caught here, reported to Sentry,
// and replaced with a recovery screen rather than blanking the whole SPA.

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Sentry } from '../lib/sentry'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#f8f9fb] text-[#1a2744] px-6 text-center"
        >
          <p className="text-3xl font-bold">Something went wrong</p>
          <p className="max-w-md text-[#717182]">
            An unexpected error occurred. Our team has been notified. Please reload the
            page or return to the home page to continue.
          </p>
          {import.meta.env.DEV && (
            <pre className="max-w-2xl overflow-auto rounded-md bg-[#1a2744] p-4 text-left text-sm text-[#a8d4f0]">
              {this.state.error.stack ?? this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-6 py-2.5 rounded-full bg-[#4a9ad4] text-[#0d1a3a] text-[15px] font-semibold hover:opacity-90 transition-opacity"
            >
              Reload page
            </button>
            <a
              href="/"
              className="px-6 py-2.5 rounded-full border border-[#1a2744] text-[#1a2744] text-[15px] font-semibold hover:bg-[#1a2744]/5 transition-colors no-underline"
            >
              Back to home
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
