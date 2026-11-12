import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeTournament,
  fetchOrganizedTournament,
  tournamentKey,
} from '../services/endpoints/organizedTournaments';
import type { TournamentMatch } from '../services/endpoints/organizedTournaments';
import PaperLoading from '../components/PaperLoading';
import TrackerQr from '../components/tracker/TrackerQr';
import TournamentSetup from '../components/tournament/TournamentSetup';
import MatchEditor, { type TournamentUpdate } from '../components/tournament/MatchEditor';
import { errorMessage } from '../utils/errors';
import '../styles/organized-tournament.css';

type TournamentTab = 'results' | 'setup';

export default function OrganizedTournament({ publicView = false }: { publicView?: boolean }) {
  const params = useParams();
  const id = (publicView ? params.publicId : params.id) ?? '';
  const client = useQueryClient();
  const query = useQuery({
    queryKey: tournamentKey(id, publicView),
    queryFn: () => fetchOrganizedTournament(id, publicView),
    retry: 1,
    refetchInterval: publicView ? 30000 : false,
  });
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [selection, setSelection] = useState<{ id: string; tab: TournamentTab } | null>(null);
  const t = query.data;
  if (t && selection?.id !== id) {
    setSelection({ id, tab: t.matches.length ? 'results' : 'setup' });
  }
  const update: TournamentUpdate = async (path, method, data) => {
    if (!t || saving.current || publicView) return false;
    saving.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await changeTournament(
        t.id,
        path,
        method,
        method === 'DELETE' ? undefined : { ...data, revision: t.revision },
      );
      client.setQueryData(tournamentKey(id, false), result);
      setNotice('Cambios guardados.');
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudieron guardar los cambios.'));
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  if (query.isPending) return <PaperLoading label="Cargando torneo" />;
  if (!t || query.isError)
    return (
      <section className="paper-panel album-sheet tournament-page tournament-section">
        <h1>Torneo no disponible</h1>
        <p role="alert">{errorMessage(query.error, 'No se pudo cargar el torneo.')}</p>
        <button className="glass-btn" onClick={() => void query.refetch()}>
          Reintentar
        </button>
        <Link to="/mis-ligas">Ir a Mis ligas</Link>
      </section>
    );
  const link = `${window.location.origin}/t/${t.publicId}`;
  const activeTab = selection?.tab;
  const setTab = (tab: TournamentTab) => setSelection({ id, tab });
  const name = (participantId: string | null) =>
    t.participants.find((p) => p.id === participantId)?.name ?? 'Por decidir';
  const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
  const selectedRound = rounds.includes(round) ? round : (rounds[0] ?? 1);
  const lastRound = rounds.at(-1) ?? 1;
  const final = t.format === 'KNOCKOUT' ? t.matches.find((m) => m.round === lastRound) : undefined;
  const winnerId =
    final?.outcome === 'HOME' ? final.homeId : final?.outcome === 'AWAY' ? final.awayId : null;
  const currentMatch = t.matches.find((m) => m.id === editing);
  function roundTitle(number: number) {
    if (t?.format !== 'KNOCKOUT') return `Jornada ${number}`;
    const remaining = lastRound - number;
    return remaining === 0
      ? 'Final'
      : remaining === 1
        ? 'Semifinales'
        : remaining === 2
          ? 'Cuartos de final'
          : `Ronda ${number}`;
  }
  function matchCard(match: TournamentMatch) {
    return (
      <li key={match.id} className="tournament-match">
        <div className={match.outcome === 'HOME' ? 'tournament-winner' : ''}>
          <span>
            {match.homeId ? name(match.homeId) : match.bye ? 'Pase libre' : 'Por decidir'}
          </span>
          <strong>{match.homeScore ?? (match.outcome === 'HOME' ? '✓' : '—')}</strong>
        </div>
        <div className={match.outcome === 'AWAY' ? 'tournament-winner' : ''}>
          <span>
            {match.awayId ? name(match.awayId) : match.bye ? 'Pase libre' : 'Por decidir'}
          </span>
          <strong>{match.awayScore ?? (match.outcome === 'AWAY' ? '✓' : '—')}</strong>
        </div>
        <p className="text-muted">
          {match.bye
            ? 'Pase automático'
            : match.outcome === 'DRAW'
              ? 'Empate · Finalizado'
              : match.outcome
                ? 'Finalizado'
                : 'Pendiente'}
          {match.scheduledAt && (
            <>
              {' '}
              ·{' '}
              <time dateTime={match.scheduledAt}>
                {new Date(match.scheduledAt).toLocaleString('es-ES', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </time>
            </>
          )}
          {match.venue && <> · {match.venue}</>}
        </p>
        {!publicView && !match.bye && (
          <button
            className="glass-btn"
            disabled={busy}
            aria-expanded={editing === match.id}
            onClick={() => setEditing(match.id)}
          >
            Editar encuentro
            <span className="sr-only">
              : {name(match.homeId)} contra {name(match.awayId)}
            </span>
          </button>
        )}
      </li>
    );
  }
  return (
    <section className="view-section active tournament-page">
      <Link to={publicView ? '/' : '/mis-ligas'}>{publicView ? 'PorrApp' : '← Mis ligas'}</Link>
      <header>
        <h1 className="poster-title">{t.name}</h1>
        <p>
          {t.activity} · {t.participants.length}{' '}
          {t.participantType === 'TEAM'
            ? 'equipos'
            : t.participantType === 'PAIR'
              ? 'parejas'
              : 'participantes'}{' '}
          ·{' '}
          {t.format === 'KNOCKOUT'
            ? 'Eliminatoria'
            : t.format === 'LEAGUE'
              ? 'Liga'
              : 'Calendario manual'}
        </p>
        {publicView ? (
          <p>Resultados del organizador. Se actualizan cada 30 segundos.</p>
        ) : (
          <p>
            {t.published
              ? 'Publicado: cualquiera con el enlace puede consultarlo.'
              : 'Borrador. La página pública estará disponible cuando lo publiques.'}
          </p>
        )}
      </header>
      {!publicView && (
        <section className="paper-panel album-sheet tournament-section">
          <div className="tournament-actions">
            <button
              className="glass-btn"
              disabled={busy}
              onClick={() => void update('publication', 'PUT', { published: !t.published })}
            >
              {t.published ? 'Retirar publicación' : 'Publicar torneo'}
            </button>
            {t.published && (
              <Link className="glass-btn" to={`/t/${t.publicId}`}>
                Ver página pública
              </Link>
            )}
          </div>
          {t.published && (
            <details>
              <summary>Compartir enlace y QR</summary>
              <p>Se puede consultar sin registrarse ni unirse.</p>
              <label>
                Enlace público
                <input
                  className="glass-input"
                  readOnly
                  value={link}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="tournament-actions">
                <button
                  className="glass-btn"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(link)
                      .then(() => setNotice('Enlace copiado.'))
                      .catch(() => setError('No se pudo copiar. Selecciona el enlace y cópialo.'))
                  }
                >
                  Copiar enlace
                </button>
                {typeof navigator.share === 'function' && (
                  <button
                    className="glass-btn"
                    onClick={() =>
                      void navigator.share({ title: t.name, url: link }).catch(() => undefined)
                    }
                  >
                    Compartir
                  </button>
                )}
              </div>
              <TrackerQr link={link} name={t.name} label={`Código QR para consultar ${t.name}`} />
            </details>
          )}
        </section>
      )}
      {error && (
        <div className="tournament-feedback" role="alert">
          <p>{error}</p>
          <button
            className="glass-btn"
            disabled={busy}
            onClick={() =>
              void query.refetch().then(() => {
                setEditing(null);
                setError('');
              })
            }
          >
            Actualizar datos
          </button>
        </div>
      )}
      <p className="tournament-notice" role="status">
        {busy ? 'Guardando…' : notice}
      </p>
      {!publicView && (
        <nav className="tournament-actions" aria-label="Secciones del torneo">
          <button
            className="glass-btn"
            aria-pressed={activeTab === 'results'}
            onClick={() => setTab('results')}
          >
            Resultados y cuadro
          </button>
          <button
            className="glass-btn"
            aria-pressed={activeTab === 'setup'}
            onClick={() => setTab('setup')}
          >
            Participantes y formato
          </button>
        </nav>
      )}
      {!publicView && activeTab === 'setup' ? (
        <TournamentSetup tournament={t} update={update} busy={busy} />
      ) : (
        <>
          {winnerId && (
            <p className="paper-panel album-sheet tournament-champion">
              Ganador del torneo: <strong>{name(winnerId)}</strong>
            </p>
          )}
          {!t.matches.length && (
            <div className="paper-panel album-sheet tournament-section">
              <h2>Encuentros por anunciar</h2>
              <p>
                {publicView
                  ? 'El organizador todavía está preparando el calendario.'
                  : 'Añade participantes y genera una liga o un cuadro, o introduce los encuentros a mano.'}
              </p>
              {!publicView && (
                <button className="glass-btn primary-btn" onClick={() => setTab('setup')}>
                  Preparar torneo
                </button>
              )}
            </div>
          )}
          {currentMatch && !publicView && (
            <section
              className="paper-panel album-sheet tournament-section"
              aria-label="Editar encuentro"
            >
              <MatchEditor
                key={`${currentMatch.id}-${t.revision}`}
                match={currentMatch}
                tournament={t}
                update={update}
                busy={busy}
                close={() => setEditing(null)}
              />
            </section>
          )}
          {!!t.matches.length &&
            (t.format === 'KNOCKOUT' ? (
              <div
                className="tournament-bracket"
                role="region"
                aria-label="Cuadro de eliminatorias"
                tabIndex={0}
              >
                {rounds.map((number) => (
                  <section key={number} className="tournament-bracket-round">
                    <h2>{roundTitle(number)}</h2>
                    <ol>{t.matches.filter((m) => m.round === number).map(matchCard)}</ol>
                  </section>
                ))}
              </div>
            ) : (
              <section className="paper-panel album-sheet tournament-section">
                <h2>Encuentros</h2>
                <label>
                  Jornada
                  <select
                    className="glass-input"
                    value={selectedRound}
                    onChange={(event) => setRound(Number(event.target.value))}
                  >
                    {rounds.map((number) => (
                      <option key={number} value={number}>
                        {roundTitle(number)}
                      </option>
                    ))}
                  </select>
                </label>
                <ol className="tournament-matches">
                  {t.matches.filter((m) => m.round === selectedRound).map(matchCard)}
                </ol>
              </section>
            ))}
          {t.format !== 'KNOCKOUT' && !!t.standings.length && (
            <section className="paper-panel album-sheet tournament-section">
              <h2>Clasificación</h2>
              <p className="text-muted">
                Victoria: {t.winPoints} · Empate: {t.drawPoints} · Derrota: {t.lossPoints}.
                Desempates por diferencia de marcador y después a favor; si persiste, comparten
                posición.
              </p>
              <div
                className="tournament-table"
                tabIndex={0}
                role="region"
                aria-label="Clasificación del torneo"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Pos.</th>
                      <th scope="col">Participante</th>
                      <th scope="col">PJ</th>
                      <th scope="col">G</th>
                      <th scope="col">E</th>
                      <th scope="col">P</th>
                      <th scope="col">Favor</th>
                      <th scope="col">Contra</th>
                      <th scope="col">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.standings.map((s, i, rows) => {
                      const same = (a: typeof s) =>
                        a.points === s.points &&
                        a.scored - a.conceded === s.scored - s.conceded &&
                        a.scored === s.scored;
                      const rank = rows.findIndex(same) + 1;
                      return (
                        <tr key={s.participantId}>
                          <td>{rank || i + 1}</td>
                          <th scope="row">{name(s.participantId)}</th>
                          <td>{s.played}</td>
                          <td>{s.won}</td>
                          <td>{s.drawn}</td>
                          <td>{s.lost}</td>
                          <td>{s.scored}</td>
                          <td>{s.conceded}</td>
                          <td>
                            <strong>{s.points}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {publicView && (
            <section className="paper-panel album-sheet tournament-section">
              <h2>Participantes</h2>
              <ol className="tournament-public-participants">
                {t.participants.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </section>
  );
}
