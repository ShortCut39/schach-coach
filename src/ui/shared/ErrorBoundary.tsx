import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../../i18n';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Wechselt der Schlüssel (z. B. der Screen), wird der Fehlerzustand zurückgesetzt */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  failed: boolean;
  resetKey: unknown;
}

/**
 * Fängt Fehler beim Anzeigen ab, damit nicht die ganze App leer wird.
 * Die Partie bleibt gespeichert (Sitzung), deshalb ist „Erneut versuchen“ gefahrlos.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Anzeigefehler', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const t = i18n.t.bind(i18n);
    return (
      <main id="main" className="flex flex-1 items-start justify-center p-5">
        <section
          role="alert"
          className="mt-16 flex max-w-[520px] flex-col items-center gap-3 rounded-panel border border-border bg-panel px-8 py-10 text-center"
        >
          <h1 className="text-lg font-semibold">{t('errors.boundaryTitle')}</h1>
          <p className="text-muted">{t('errors.boundaryText')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="primary"
              className="min-h-hit px-5 text-sm"
              onClick={() => this.setState({ failed: false })}
            >
              {t('errors.boundaryRetry')}
            </Button>
            <Button
              variant="secondary"
              className="min-h-hit text-sm"
              onClick={() => window.location.reload()}
            >
              {t('errors.boundaryReload')}
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
