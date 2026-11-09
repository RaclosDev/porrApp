import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ConfirmDialog from '../../components/ConfirmDialog';
import LeaveGuard from '../../components/LeaveGuard';
import { useUnsavedChanges } from '../../utils/unsavedChanges';

/** Pantalla de predicción de pega: un cambio la deja sin guardar y «Guardar» la limpia. */
function Predictor() {
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty, 'Tu predicción tiene cambios sin guardar.');
  return (
    <>
      <button type="button" onClick={() => setDirty(true)}>
        Cambiar
      </button>
      <button type="button" onClick={() => setDirty(false)}>
        Guardar
      </button>
      <Link to="/ranking">Ranking</Link>
      <Link to="/prediction?ronda=2">Otra ronda</Link>
    </>
  );
}

function renderApp() {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ConfirmDialog />
            <LeaveGuard />
            <Outlet />
          </>
        ),
        children: [
          { path: '/prediction', element: <Predictor /> },
          { path: '/ranking', element: <h1>Ranking de la liga</h1> },
        ],
      },
    ],
    { initialEntries: ['/prediction'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

/** Lo que hace el navegador al cerrar o recargar: devuelve si la página pidió confirmación. */
function closeTab() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('LeaveGuard', () => {
  it('sin cambios deja salir sin preguntar, también al cerrar la pestaña', async () => {
    renderApp();

    expect(closeTab()).toBe(false);
    fireEvent.click(screen.getByRole('link', { name: 'Ranking' }));

    expect(await screen.findByRole('heading', { name: 'Ranking de la liga' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('con cambios sin guardar pregunta y «Seguir aquí» cancela la salida', async () => {
    const router = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));

    fireEvent.click(screen.getByRole('link', { name: 'Ranking' }));

    const dialog = await screen.findByRole('alertdialog', { name: '¿Salir sin guardar?' });
    expect(dialog).toHaveAccessibleDescription('Tu predicción tiene cambios sin guardar.');
    fireEvent.click(screen.getByRole('button', { name: 'Seguir aquí' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/prediction');
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
  });

  it('«Salir» sigue a la pantalla pedida y deja de avisar', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    fireEvent.click(screen.getByRole('link', { name: 'Ranking' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(await screen.findByRole('heading', { name: 'Ranking de la liga' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(closeTab()).toBe(false);
  });

  it('avisa al cerrar o recargar la pestaña solo mientras haya cambios', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(closeTab()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(closeTab()).toBe(false);
  });

  it('no pregunta al moverse dentro de la misma pantalla', async () => {
    const router = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));

    fireEvent.click(screen.getByRole('link', { name: 'Otra ronda' }));

    await waitFor(() => expect(router.state.location.search).toBe('?ronda=2'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('si se guarda mientras pregunta, sale sin esperar respuesta', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    fireEvent.click(screen.getByRole('link', { name: 'Ranking' }));
    await screen.findByRole('alertdialog');

    // El guardado automático termina con el diálogo abierto.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('heading', { name: 'Ranking de la liga' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
