import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupCard from '../../../components/groups/GroupCard';
import { group } from '../../context/fixtures';
import type { LeagueSummary } from '../../../types/api';

const renderCard = (summary?: LeagueSummary) =>
  render(
    <GroupCard
      group={group({ id: 7, name: 'Amigos' })}
      summary={summary}
      isSelected={false}
      isCreator={false}
      handleEnterGroup={vi.fn()}
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
});
