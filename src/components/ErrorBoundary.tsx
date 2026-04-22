import { Button } from '@/components/ui/button'
import { RotateCw } from 'lucide-react'
import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 p-4">
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
          {this.state.error?.message && (
            <>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(this.state.error!.message)
                }}
                variant="secondary"
              >
                Copy Error Message
              </Button>
              <pre className="whitespace-pre-wrap text-wrap wrap-break-word rounded bg-destructive/10 p-2 text-destructive">
                Error: {this.state.error.message}
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
