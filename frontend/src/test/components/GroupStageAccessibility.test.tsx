import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupStage from '../../components/GroupStage';

describe('GroupStage accessibility', () => {
  it('announces whether a third-place team is selected', () => {
    render(
      <GroupStage
        groupOdds={{}}
        onComplete={vi.fn()}
        activeGroupId="accessibility-third"
        userId="reader"
        initialSelections={{ A: { first: 'México', second: 'Sudáfrica', third: 'Chequia' } }}
        initialThirds={['Chequia']}
      />,
    );
    const third = screen.getByRole('button', { name: 'Chequia' });
    expect(third).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(third);
    expect(third).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(third);
    expect(third).toHaveAttribute('aria-pressed', 'true');
  });
});
