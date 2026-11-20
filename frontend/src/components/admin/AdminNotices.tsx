import { useMutation } from '@tanstack/react-query';
import { BellRing, Search, Send } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { sendAdminAnnouncement } from '../../services/endpoints/admin';
import type { AdminAnnouncementResult, AdminOverview } from '../../types/api';
import { confirmAction } from '../../utils/confirmAction';
import { errorMessage } from '../../utils/errors';
import { kindLabel, normalize } from './adminFormat';

/** Mismos límites que AdminAnnouncementService en el backend. */
const MAX_TITLE = 60;
const MAX_BODY = 240;
const MAX_LEAGUES = 20;
const MAX_SENDS_PER_HOUR = 5;

/** Longitud en caracteres visibles, como la cuenta el servidor (un emoji cuenta uno). */
const length = (text: string) => [...text].length;

function Counter({ value, max, id }: { value: string; max: number; id: string }) {
  const used = length(value);
  return (
    <span id={id} className={`admin-field-count ${used > max * 0.85 ? 'is-near' : ''}`}>
      {used}/{max}
    </span>
  );
}

function ResultCard({ result }: { result: AdminAnnouncementResult }) {
  const hasFailures = result.failed > 0;
  return (
    <div
      className={`league-admin-card admin-result ${hasFailures ? 'has-failures' : ''}`}
      role="status"
    >
      <h3 className="admin-section-title">
        {result.devices === 0 ? 'Nadie tiene los avisos activados' : 'Aviso enviado'}
      </h3>
      <p className="admin-section-hint">
        {result.members} {result.members === 1 ? 'miembro' : 'miembros'} en {result.leagues}{' '}
        {result.leagues === 1 ? 'liga' : 'ligas'}.
      </p>
      <dl className="admin-result-grid">
        <div>
          <dt>Dispositivos</dt>
          <dd>{result.devices}</dd>
        </div>
        <div className="is-ok">
          <dt>Enviados</dt>
          <dd>{result.sent}</dd>
        </div>
        <div>
          <dt>En reintento</dt>
          <dd>{result.retrying}</dd>
        </div>
        <div className={hasFailures ? 'is-bad' : ''}>
          <dt>Fallidos</dt>
          <dd>{result.failed}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Pestaña «Avisos»: manda un aviso push a los miembros de las ligas elegidas.
 * Cada miembro lo recibe una vez por dispositivo aunque esté en varias de las ligas.
 */
export default function AdminNotices({ leagues }: { leagues: AdminOverview['leagues'] }) {
  const ids = useId();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const visible = useMemo(() => {
    const query = normalize(search.trim());
    return query ? leagues.filter((l) => normalize(l.name).includes(query)) : leagues;
  }, [leagues, search]);
  const chosen = leagues.filter((l) => selected.has(l.id));
  const memberSeats = chosen.reduce((sum, l) => sum + l.members, 0);
  const full = selected.size >= MAX_LEAGUES;

  const mutation = useMutation({
    mutationFn: sendAdminAnnouncement,
    onSuccess: () => {
      setTitle('');
      setBody('');
    },
  });

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_LEAGUES) next.add(id);
      return next;
    });

  const selectVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const l of visible) {
        if (next.size >= MAX_LEAGUES) break;
        next.add(l.id);
      }
      return next;
    });

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const missing = [
    selected.size === 0 && 'elige al menos una liga',
    !trimmedTitle && 'escribe un título',
    !trimmedBody && 'escribe el texto',
  ].filter(Boolean) as string[];
  const canSend =
    missing.length === 0 &&
    length(trimmedTitle) <= MAX_TITLE &&
    length(trimmedBody) <= MAX_BODY &&
    !mutation.isPending;

  const send = async () => {
    if (!canSend) return;
    const names = chosen.map((l) => l.name);
    const confirmed = await confirmAction({
      title: '¿Mandar este aviso?',
      message: `Llegará al momento a los dispositivos con avisos activados de ${
        chosen.length === 1 ? 'la liga' : `las ${chosen.length} ligas`
      } y no se puede retirar.`,
      details: [
        `«${trimmedTitle}»`,
        names.length <= 5
          ? `Ligas: ${names.join(', ')}`
          : `Ligas: ${names.slice(0, 5).join(', ')} y ${names.length - 5} más`,
      ],
      confirmLabel: 'Mandar aviso',
      cancelLabel: 'Revisar',
    });
    if (!confirmed) return;
    mutation.mutate({ leagueIds: [...selected], title: trimmedTitle, body: trimmedBody });
  };

  const titleId = `${ids}-title`;
  const bodyId = `${ids}-body`;

  return (
    <div className="admin-notice-layout">
      <section className="league-admin-card admin-notice-column" aria-labelledby={`${ids}-leagues`}>
        <div className="league-admin-card-head">
          <h2 className="admin-section-title" id={`${ids}-leagues`}>
            1. Ligas
          </h2>
          <span className="admin-pill is-accent" aria-live="polite">
            {selected.size}/{MAX_LEAGUES} elegidas
          </span>
        </div>
        <div className="league-admin-toolbar">
          <div className="league-admin-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              className="glass-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar liga…"
              aria-label="Buscar liga"
            />
          </div>
        </div>
        <ul className="admin-league-picker" aria-label="Ligas a las que mandar el aviso">
          {visible.map((l) => {
            const checked = selected.has(l.id);
            const disabled = !checked && full;
            return (
              <li key={l.id}>
                <label
                  className={`admin-league-option ${checked ? 'is-checked' : ''} ${
                    disabled ? 'is-disabled' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(l.id)}
                  />
                  <span className="admin-league-option-name">{l.name}</span>
                  <span className="admin-league-option-meta">
                    {kindLabel(l.kind)} · {l.members} {l.members === 1 ? 'miembro' : 'miembros'}
                  </span>
                </label>
              </li>
            );
          })}
          {visible.length === 0 && <li className="admin-table-empty">Ninguna liga coincide.</li>}
        </ul>
        <div className="admin-picker-actions">
          <button
            type="button"
            className="league-admin-text-btn"
            onClick={selectVisible}
            disabled={full || visible.length === 0}
          >
            Elegir {search.trim() ? 'las mostradas' : 'todas'}
          </button>
          <button
            type="button"
            className="league-admin-text-btn"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            Quitar todas
          </button>
          {full && (
            <span className="admin-section-hint">Máximo {MAX_LEAGUES} ligas por aviso.</span>
          )}
        </div>
      </section>

      <section className="league-admin-card admin-notice-column" aria-labelledby={`${ids}-message`}>
        <h2 className="admin-section-title" id={`${ids}-message`}>
          2. Mensaje
        </h2>
        <div className="admin-field">
          <label className="admin-field-label" htmlFor={titleId}>
            Título
            <Counter value={title} max={MAX_TITLE} id={`${titleId}-count`} />
          </label>
          <input
            id={titleId}
            className="glass-input"
            value={title}
            maxLength={MAX_TITLE * 2}
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby={`${titleId}-count`}
            aria-invalid={length(title.trim()) > MAX_TITLE}
            placeholder="Ej.: Nueva jornada disponible"
            autoComplete="off"
          />
        </div>
        <div className="admin-field">
          <label className="admin-field-label" htmlFor={bodyId}>
            Texto
            <Counter value={body} max={MAX_BODY} id={`${bodyId}-count`} />
          </label>
          <textarea
            id={bodyId}
            className="glass-input"
            rows={4}
            value={body}
            maxLength={MAX_BODY * 2}
            onChange={(event) => setBody(event.target.value)}
            aria-describedby={`${bodyId}-count`}
            aria-invalid={length(body.trim()) > MAX_BODY}
            placeholder="Ej.: Ya podéis hacer vuestras predicciones de la jornada 12."
          />
        </div>

        <div
          className={`admin-push-preview ${trimmedTitle || trimmedBody ? '' : 'is-empty'}`}
          aria-label="Vista previa del aviso"
          role="group"
        >
          <img src="/icon-paper-192.png" alt="" width={36} height={36} />
          <div className="admin-push-preview-text">
            <span className="admin-push-preview-app">
              <BellRing size={11} aria-hidden="true" /> PorrApp
            </span>
            <span className="admin-push-preview-title">{trimmedTitle || 'Título del aviso'}</span>
            <span className="admin-push-preview-body">{trimmedBody || 'Texto del aviso'}</span>
          </div>
        </div>

        <ul className="admin-notice-rules">
          <li>
            Llega solo a quien tiene los avisos push activados en algún dispositivo; quien esté en
            varias ligas lo recibe una vez.
          </li>
          <li>
            No depende de las preferencias de avisos (recordatorios, jornadas…): es un aviso general
            que se manda de tarde en tarde.
          </li>
          <li>Como mucho {MAX_SENDS_PER_HOUR} avisos por hora. Al tocarlo se abre la app.</li>
        </ul>

        <div className="admin-send-row">
          <span className="admin-send-summary" aria-live="polite">
            {missing.length > 0
              ? `Para mandarlo: ${missing.join(', ')}.`
              : `${chosen.length} ${chosen.length === 1 ? 'liga' : 'ligas'} · hasta ${memberSeats} ${
                  memberSeats === 1 ? 'miembro' : 'miembros'
                }`}
          </span>
          <button
            type="button"
            className="league-admin-btn is-primary"
            onClick={() => void send()}
            disabled={!canSend}
          >
            {mutation.isPending ? (
              'Mandando…'
            ) : (
              <>
                <Send size={15} aria-hidden="true" /> Mandar aviso
              </>
            )}
          </button>
        </div>

        {mutation.isError && (
          <p className="admin-error" role="alert">
            {errorMessage(mutation.error, 'No se pudo enviar el aviso')}
          </p>
        )}
        {mutation.isSuccess && <ResultCard result={mutation.data} />}
      </section>
    </div>
  );
}
