/**
 * Clave de un equipo en la clasificación oficial (`GroupStandings`). El backend quita `. # $ [ ]`
 * del nombre (herencia de Firebase, que no los admitía en claves): «Bosnia y Her.» es «Bosnia y Her».
 * Si se cambia, hay que cambiarlo a la vez en `StandingsService`.
 */
export const teamKey = (name: string) => name.replace(/[.#$[\]]/g, '');
