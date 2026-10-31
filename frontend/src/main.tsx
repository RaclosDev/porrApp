import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { initSession } from './services/api';

// Antes de pintar: las consultas del primer render esperan a tener el access token.
initSession();

const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '498045926443-u02u6penjkggongduv26qlm7934449ee.apps.googleusercontent.com';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GoogleOAuthProvider clientId={googleClientId}>
            <App />
          </GoogleOAuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
