import { Link } from 'react-router-dom';
import type { Group } from '../../types/api';
import { copyWithToast, joinLink, shareJoinLinkOnWhatsApp } from '../../utils/leagueInvite';

/** A dónde lleva el primer paso tras crear la liga, según su formato. */
function nextAction(group: Group): { to: string; label: string } {
  if (group.customCompetition) {
    return { to: `/mis-ligas?gestionar=${group.id}`, label: 'Configurar mi competición' };
  }
  if (group.poolFormat === 'GRAND_PRIX') {
    return { to: '/jornadas', label: 'Predecir el próximo Gran Premio' };
  }
  if (group.poolFormat === 'SURVIVOR') {
    return { to: '/jornadas', label: 'Elegir mi equipo' };
  }
  if (group.poolFormat === 'MATCH_DAY') {
    return { to: '/jornadas', label: 'Hacer mis predicciones' };
  }
  return { to: '/prediction', label: 'Rellenar mi porra' };
}

/** Liga recién creada: su código para invitar, el enlace, WhatsApp y el siguiente paso. */
export default function LeagueInvitePanel({
  group,
  imageFailed,
}: {
  group: Group;
  imageFailed: boolean;
}) {
  const code = group.joinCode ?? '';
  const next = nextAction(group);
  return (
    <div className="create-league-done">
      <p className="create-league-done-name marker-ink">«{group.name}»</p>
      {imageFailed && (
        <p className="create-league-error" role="alert">
          La imagen no se pudo subir. Ponla desde Administrar.
        </p>
      )}

      {code && (
        <div className="create-league-code">
          <p className="create-league-hint">Código de invitación</p>
          <p className="create-league-code-value">{code}</p>
          <div className="create-league-inline is-center">
            <button
              type="button"
              className="glass-btn create-league-small-btn"
              onClick={() => void copyWithToast(code, `Código ${code} copiado`)}
            >
              Copiar código
            </button>
            <button
              type="button"
              className="glass-btn create-league-small-btn"
              onClick={() => void copyWithToast(joinLink(code), 'Enlace copiado')}
            >
              Copiar enlace
            </button>
          </div>
        </div>
      )}

      <div className="create-league-done-actions">
        {code && (
          <button
            type="button"
            className="glass-btn create-league-wide-btn"
            onClick={() => shareJoinLinkOnWhatsApp(code)}
          >
            Compartir en WhatsApp
          </button>
        )}
        <Link to={next.to} className="glass-btn primary-btn create-league-wide-btn">
          {next.label}
        </Link>
        <Link to="/mis-ligas" className="create-league-link">
          Ver mis ligas
        </Link>
      </div>
    </div>
  );
}
