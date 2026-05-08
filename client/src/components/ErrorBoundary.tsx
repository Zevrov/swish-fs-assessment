import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

// Last-resort guard against uncaught render-time exceptions. Without this,
// a single bad component throws past React and the user sees a blank screen.
// We log the error to the console (dev) and offer a reload, which is the
// least-bad recovery without a server-side log destination.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Real apps would forward these to Sentry / Datadog / Honeycomb / etc.
    // eslint-disable-next-line no-console
    console.error('Uncaught render error:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="error-container" role="alert">
          <h3>Something went wrong</h3>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
