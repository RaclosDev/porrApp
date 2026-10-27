import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock de window.matchMedia para componentes responsive
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock de Google Identity (@react-oauth/google)
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () =>
    React.createElement('button', { 'data-testid': 'google-login-btn' }, 'Google Sign In'),
  useGoogleLogin: () => vi.fn(),
}));
