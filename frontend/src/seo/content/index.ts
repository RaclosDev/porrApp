/** Páginas públicas de contenido, en el orden en que se enlazan y salen en el sitemap. */
import { comoFunciona } from './como-funciona';
import { porraLaliga } from './porra-laliga';
import { porraChampions } from './porra-champions';
import { porraPremierLeague } from './porra-premier-league';
import { porraMundial } from './porra-mundial';
import { porraF1 } from './porra-f1';
import { porraUfc } from './porra-ufc';
import { porraNba } from './porra-nba';
import { porraNfl } from './porra-nfl';
import { porraTenis } from './porra-tenis';
import { plantillaPorraExcel } from './plantilla-porra-excel';
import { alternativaLaporra } from './alternativa-laporra';
import { mejoresAppsPorra } from './mejores-apps-porra';
import { porraOficina } from './porra-oficina';
import { porraVsQuiniela } from './porra-vs-quiniela';
import { porraCopaDelRey } from './porra-copa-del-rey';
import { apuntarPuntosJuegosDeMesa } from './apuntar-puntos-juegos-de-mesa';
import { timbasDePoker } from './timbas-de-poker';
import { porraEntreAmigos } from './porra-entre-amigos';
import { comoHacerUnaPorra } from './como-hacer-una-porra';
import { instalarAppMovil } from './instalar-app-movil';
import type { ContentPage } from './shared';

export const CONTENT_PAGES: ContentPage[] = [
  comoFunciona,
  porraLaliga,
  porraChampions,
  porraPremierLeague,
  porraMundial,
  porraF1,
  porraUfc,
  porraNba,
  porraNfl,
  porraTenis,
  plantillaPorraExcel,
  alternativaLaporra,
  mejoresAppsPorra,
  porraOficina,
  porraVsQuiniela,
  porraCopaDelRey,
  apuntarPuntosJuegosDeMesa,
  timbasDePoker,
  porraEntreAmigos,
  comoHacerUnaPorra,
  instalarAppMovil,
];
