import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ViewerHeader from '../../components/prediction/ViewerHeader';
import type { ViewerPoints } from '../../utils/predictionViewer';

const points = (extra: Partial<ViewerPoints> = {}) =>
  ({ total: 12, log: [], ...extra }) as unknown as ViewerPoints;

const renderHeader = (p: ViewerPoints) =>
  render(
    <ViewerHeader handleClose={() => {}} inline onEdit={null} part={{ user: 'Ana' }} points={p} />,
  );

describe('ViewerHeader', () => {
  it("shows the participant's photo next to the title", () => {
    renderHeader(points({ userId: 3, avatarUrl: '/api/users/3/avatar' }));
    expect(screen.getByRole('heading', { name: 'Porra de Ana' })).toBeInTheDocument();
    expect(screen.getByTestId('avatar-image').querySelector('img')).toHaveAttribute(
      'src',
      '/api/users/3/avatar',
    );
  });

  it('falls back to a generated avatar without a photo', () => {
    renderHeader(points({ userId: 3, avatarUrl: null }));
    expect(screen.getByTestId('avatar-generated')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
  });
});
