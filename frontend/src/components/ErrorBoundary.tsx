import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó un error no controlado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Esta pantalla ha fallado
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ha ocurrido un problema inesperado en la aplicación. Puedes intentar recargar la
                página o volver a la pantalla de inicio.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs text-rose-300 font-mono break-all max-h-28 overflow-y-auto">
                {this.state.error.message || 'Error desconocido'}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={this.handleReload}
                className="glass-btn primary-btn w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar página
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 font-medium rounded-xl transition flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Volver al inicio
              </button>

              <button
                onClick={this.handleResetStorage}
                className="w-full min-h-11 py-2 px-3 text-xs text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpiar datos locales y reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
