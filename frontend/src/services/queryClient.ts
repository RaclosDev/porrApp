import { QueryClient } from '@tanstack/react-query';

/** Caché de consultas de la app. Es un módulo para que `logout()` pueda vaciarla. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 300_000,
    },
  },
});
