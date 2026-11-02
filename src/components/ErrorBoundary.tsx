import { copyText } from '@/lib/native-system'
import { Button } from '@/components/ui/button'
import { isElectron } from '@/lib/platform'
import { RotateCw } from 'lucide-react'
import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  componentStack?: string
  occurredAt?: string
  copyStatus?: 'copied' | 'failed'
  resolvedStack?: string
  resolvedComponentStack?: string
  resolving?: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private disposed = false

  componentDidMount() {
    this.disposed = false
  }

  componentWillUnmount() {
    this.disposed = true
  }

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, occurredAt: new Date().toISOString() }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    const componentStack = errorInfo.componentStack ?? ''
    this.setState({ componentStack, resolving: true })
    void import('@/lib/resolve-error-stack')
      .then(({ resolveErrorStacks }) =>
        resolveErrorStacks([error?.stack || String(error), componentStack])
      )
      .then(([resolvedStack, resolvedComponentStack]) => {
        if (!this.disposed)
          this.setState({
            resolvedStack,
            resolvedComponentStack,
            resolving: false,
            copyStatus: undefined
          })
      })
      .catch(() => {
        if (!this.disposed) this.setState({ resolving: false })
      })
  }

  private getReport() {
    const { error, componentStack, occurredAt } = this.state
    return [
      `Jumble ${import.meta.env.APP_VERSION} (${import.meta.env.GIT_COMMIT})`,
      `Time: ${occurredAt}`,
      '',
      'Error stack (source mapped where available):',
      this.state.resolvedStack || error?.stack || String(error),
      '',
      `Mode: ${isElectron() ? 'Electron' : 'Web'}`,
      `Path: ${window.location.pathname}`,
      `Browser: ${navigator.userAgent}`,
      `Language: ${navigator.language}`,
      `Online: ${navigator.onLine}`,
      '',
      'Original error stack:',
      error?.stack || String(error),
      '',
      'Component stack:',
      this.state.resolvedComponentStack || componentStack || '(unavailable)'
    ].join('\n')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 p-4">
          <h1 className="text-2xl font-bold">Oops, something went wrong.</h1>
          <p className="max-w-md text-center text-lg">
            Sorry for the inconvenience. If you don't mind helping, you can{' '}
            <a
              href="https://github.com/CodyTseng/jumble/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              submit an issue on GitHub
            </a>{' '}
            with the error details, or{' '}
            <a
              href="https://jumble.social/npub1syjmjy0dp62dhccq3g97fr87tngvpvzey08llyt6ul58m2zqpzps9wf6wl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              mention me
            </a>
            . Thank you for your support!
          </p>
          {this.state.hasError && (
            <>
              <Button
                onClick={async () => {
                  try {
                    await copyText(this.getReport())
                    this.setState({ copyStatus: 'copied' })
                  } catch {
                    this.setState({ copyStatus: 'failed' })
                  }
                }}
                variant="secondary"
              >
                Copy Error Details
              </Button>
              {this.state.resolving && (
                <p role="status" className="text-muted-foreground text-sm">
                  Resolving source locations...
                </p>
              )}
              {this.state.copyStatus && (
                <p role="status" className="text-muted-foreground text-sm">
                  {this.state.copyStatus === 'copied'
                    ? 'Copied'
                    : 'Could not copy. Please select and copy the details below.'}
                </p>
              )}
              <pre
                dir="ltr"
                tabIndex={0}
                className="bg-destructive/10 text-destructive max-h-[40dvh] w-full max-w-2xl overflow-auto rounded p-3 text-start text-xs break-words whitespace-pre-wrap select-text"
              >
                {this.getReport()}
              </pre>
            </>
          )}
          <Button onClick={() => window.location.reload()} className="mt-2">
            <RotateCw />
            Reload Page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
