/** Texto comparable en búsquedas: sin tildes y en minúsculas. */
export const foldText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
