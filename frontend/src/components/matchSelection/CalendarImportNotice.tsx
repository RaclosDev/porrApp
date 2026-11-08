import type { MatchSelectionView } from '../../types/api';
import { calendarImports, describeCompetitions } from './matchSelection';

/**
 * Aviso de las competiciones del calendario que el servidor está cargando de ESPN porque nunca se
 * habían importado, o de por qué no se han podido cargar.
 */
export default function CalendarImportNotice({
  calendar,
}: {
  calendar: Pick<MatchSelectionView, 'competitions'> | null | undefined;
}) {
  const { loading, errors } = calendarImports(calendar);
  // La región de estado está siempre para que el lector anuncie el cambio al empezar la carga.
  return (
    <>
      <p className="create-league-hint" role="status">
        {loading.length > 0 ? `Cargando partidos de ${describeCompetitions(loading)}…` : ''}
      </p>
      {errors.map((message) => (
        <p key={message} className="create-league-error" role="alert">
          {message}
        </p>
      ))}
    </>
  );
}
