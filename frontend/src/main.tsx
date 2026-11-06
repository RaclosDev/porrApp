import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { initSession } from './services/api';
import { installErrorReporting } from './services/errorReporting';
import { initInstallPrompt } from './services/installPrompt';
import { initAnalytics } from './services/analytics';

// Antes de pintar: las consultas del primer render esperan a tener el access token.
initSession();
installErrorReporting();
initInstallPrompt();
initAnalytics();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
