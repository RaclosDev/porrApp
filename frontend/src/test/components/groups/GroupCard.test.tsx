import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupCard from '../../../components/groups/GroupCard';
import { group } from '../../context/fixtures';
import type { Group, LeagueSummary } from '../../../types/api';

const handleEnterGroup = vi.fn();
const handleRepeatGroup = vi.fn(async () => {});

const renderCard = (summary?: LeagueSummary, fields: Partial<Group> = {}, isCreator = false) =>
  render(
    <GroupCard
      group={group({ id: 7, name: 'Amigos', ...fields })}
      summary={summary}
      isSelected={false}
      isCreator={isCreator}
      handleEnterGroup={handleEnterGroup}
      handleRepeatGroup={handleRepeatGroup}
      handleLeaveGroup={vi.fn()}
      handleCopyCode={vi.fn()}
      handleCopyLink={vi.fn()}
      handleShareWhatsApp={vi.fn()}
      setSelectedGroupForMembers={vi.fn()}
      setSelectedGroupForRules={vi.fn()}
      setSelectedCustomCompetition={vi.fn()}
    />,
  );

describe('GroupCard', () => {
  it('muestra la posición, los puntos y las predicciones pendientes', () => {
    renderCard({ groupId: 7, rank: 2, points: 40, participants: 9, pendingPredictions: 3 });

    expect(screen.getByText('2.º de 9 · 40 pts')).toBeInTheDocument();
    expect(screen.getByText('Te faltan 3 predicciones')).toBeInTheDocument();
  });

  it('no muestra nada si aún no hay predicción ni pendientes', () => {
    renderCard({ groupId: 7, rank: null, points: null, participants: 4, pendingPredictions: 0 });

    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Te falta/)).not.toBeInTheDocument();
  });

  it('una liga en juego no habla de temporadas', () => {
    renderCard(undefined, { season: '2026/27', seasonEnded: false });

    expect(screen.queryByText('Terminada')).not.toBeInTheDocument();
    expect(screen.queryByText(/2026\/27/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Repetir liga' })).not.toBeInTheDocument();
  });

  it('quien administra una liga terminada puede repetirla para la temporada nueva', async () => {
    const ended = { season: '2025/26', seasonEnded: true, canRepeat: true, nextSeason: '2026/27' };
    renderCard(undefined, ended, true);

    expect(screen.getByText('Terminada')).toBeInTheDocument();
    expect(screen.getByText(/2025\/26/)).toBeInTheDocument();
    expect(screen.getByText(/Ya hay temporada 2026\/27/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Repetir liga' }));

    expect(handleRepeatGroup).toHaveBeenCalledWith(expect.objectContaining({ id: 7, ...ended }));
    // Al acabar, el botón vuelve a estar disponible.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Repetir liga' })).toBeEnabled());
  });

  it('un miembro ve que se puede repetir, pero no el botón', () => {
    renderCard(undefined, { seasonEnded: true, canRepeat: true, nextSeason: '2026/27' });

    expect(screen.getByText(/quien administra la liga puede repetirla/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Repetir liga' })).not.toBeInTheDocument();
  });

  it('ya repetida, lleva a la liga de la temporada nueva', () => {
    renderCard(undefined, { seasonEnded: true, canRepeat: false, nextLeagueId: 12 }, true);

    expect(screen.queryByRole('button', { name: 'Repetir liga' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la liga de la temporada nueva' }));

    expect(handleEnterGroup).toHaveBeenCalledWith(12);
  });

  it('terminada y sin temporada nueva todavía, solo lleva el sello', () => {
    renderCard(undefined, { season: '2025/26', seasonEnded: true, canRepeat: false }, true);

    expect(screen.getByText('Terminada')).toBeInTheDocument();
    expect(screen.queryByText(/Ya hay temporada/)).not.toBeInTheDocument();
  });
});
