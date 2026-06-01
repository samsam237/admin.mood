import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; info: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, info: errorInfo.componentStack ?? '' });
    console.error('[ErrorBoundary] Caught:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h2 className="text-red-700 font-bold mb-2">Erreur de rendu</h2>
            <p className="text-red-600 text-sm font-mono mb-3">{this.state.error.message}</p>
            <details className="text-xs text-red-500">
              <summary className="cursor-pointer font-medium mb-1">Component stack</summary>
              <pre className="whitespace-pre-wrap mt-2">{this.state.info}</pre>
            </details>
            <button
              onClick={() => this.setState({ error: null, info: '' })}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
