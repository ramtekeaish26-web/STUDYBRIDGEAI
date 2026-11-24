import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('STUDYBRIDGE ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#e8eaf0] p-6">
          <div className="neu-raised max-w-lg p-7 text-center">
            <AlertCircle className="mx-auto h-9 w-9 text-[#b91c1c]" />
            <h1 className="mt-3 text-xl font-semibold text-[#1e2436]">
              Something went wrong
            </h1>
            <p className="mt-2 break-words text-xs leading-relaxed text-[#5a6378]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="neu-btn mt-5 inline-flex min-h-[42px] items-center gap-2 px-5 py-2 text-xs font-semibold text-[#6366f1]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Recover Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
