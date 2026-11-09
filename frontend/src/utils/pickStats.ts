/** Lo que ya se sabe de una elección: se cumplió, no se cumplió o aún no se sabe. */
export type RealStatus = 'yes' | 'no' | 'pending';

export const percent = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;
