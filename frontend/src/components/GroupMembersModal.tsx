import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchGroupMembers,
  toggleGroupMemberPayment,
  kickGroupMember,
  regenerateGroupJoinCode,
} from '../services/api';

export default function GroupMembersModal({
  groupId,
  groupName,
  currentJoinCode,
  isAdmin,
  onClose,
  onCodeRegenerated,
}) {
  const queryClient = useQueryClient();
  const [activeCode, setActiveCode] = useState(currentJoinCode || '');
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => fetchGroupMembers(groupId),
    enabled: Boolean(groupId),
  });

  const togglePaymentMutation = useMutation({
    mutationFn: ({ userId, status }) => toggleGroupMemberPayment(groupId, userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err) => setActionError(err.message || 'Error al cambiar estado de pago'),
  });

  const kickMutation = useMutation({
    mutationFn: (userId) => kickGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err) => setActionError(err.message || 'Error al expulsar al miembro'),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateGroupJoinCode(groupId),
    onSuccess: (data) => {
      if (data.joinCode) {
        setActiveCode(data.joinCode);
        onCodeRegenerated?.(data.joinCode);
      }
    },
    onError: (err) => setActionError(err.message || 'Error al regenerar código'),
  });

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${activeCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleKick = (userId, name) => {
    if (
      window.confirm(
        `¿Estás seguro de que deseas expulsar a "${name}" de la liga?\nSe eliminarán sus pronósticos asociados a esta liga.`,
      )
    ) {
      kickMutation.mutate(userId);
    }
  };

  const paidCount = members.filter((m) => m.paymentStatus === 'PAID').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-members-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '88vh',
          background: '#0f172a',
          border: '1px solid rgba(0, 210, 211, 0.3)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#00d2d3',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              👥 Gestión de Participantes
            </div>
            <h2
              id="group-members-title"
              style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 800 }}
            >
              {groupName}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Resumen de invitación y pagos */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 210, 211, 0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Código de Entrada:{' '}
              </span>
              <strong style={{ color: '#00d2d3', letterSpacing: '2px', fontSize: '1.1rem' }}>
                {activeCode}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyLink}
                className="glass-btn"
                style={{
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  background: copied ? '#2ecc71' : 'rgba(0, 210, 211, 0.2)',
                  color: copied ? '#000' : '#00d2d3',
                  border: '1px solid rgba(0, 210, 211, 0.4)',
                  cursor: 'pointer',
                }}
              >
                {copied ? '✅ Enlace Copiado' : '🔗 Copiar Enlace'}
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        '¿Deseas regenerar el código de invitación?\nEl código anterior dejará de funcionar para nuevos miembros.',
                      )
                    ) {
                      regenerateMutation.mutate();
                    }
                  }}
                  disabled={regenerateMutation.isPending}
                  className="glass-btn"
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                  }}
                  title="Regenerar código si se ha filtrado"
                >
                  🔄
                </button>
              )}
            </div>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', gap: '16px', fontSize: '0.82rem' }}>
            <span style={{ color: '#fff' }}>
              👥 Total: <strong>{members.length}</strong>
            </span>
            <span style={{ color: '#2ecc71' }}>
              🟢 Pagados: <strong>{paidCount}</strong>
            </span>
            <span style={{ color: '#ff7675' }}>
              🔴 Pendientes: <strong>{members.length - paidCount}</strong>
            </span>
          </div>
        </div>

        {actionError && (
          <div
            style={{
              margin: '10px 20px 0',
              padding: '8px 12px',
              background: 'rgba(231, 76, 60, 0.2)',
              color: '#ff7675',
              borderRadius: '8px',
              fontSize: '0.85rem',
            }}
          >
            ⚠️ {actionError}
          </div>
        )}

        {/* Lista de Miembros */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              Cargando miembros de la liga...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#ff7675' }}>
              Error al cargar los miembros.
            </div>
          )}

          {!isLoading &&
            !error &&
            members.map((m) => {
              const isPaid = m.paymentStatus === 'PAID';
              return (
                <div
                  key={m.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {/* Info Usuario */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: m.isAdmin ? '#00d2d3' : 'rgba(255, 255, 255, 0.1)',
                        color: m.isAdmin ? '#000' : '#fff',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      {m.participantName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: '#fff',
                          fontSize: '0.92rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{m.participantName}</span>
                        {m.isAdmin && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              background: 'rgba(0, 210, 211, 0.2)',
                              color: '#00d2d3',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              fontWeight: 700,
                            }}
                          >
                            ADMIN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones y Pagos */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Toggle de Pago */}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() =>
                          togglePaymentMutation.mutate({
                            userId: m.userId,
                            status: isPaid ? 'PENDING' : 'PAID',
                          })
                        }
                        disabled={togglePaymentMutation.isPending}
                        className="glass-btn"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          background: isPaid
                            ? 'rgba(46, 204, 113, 0.15)'
                            : 'rgba(231, 76, 60, 0.15)',
                          color: isPaid ? '#2ecc71' : '#ff7675',
                          border: isPaid
                            ? '1px solid rgba(46, 204, 113, 0.4)'
                            : '1px solid rgba(231, 76, 60, 0.4)',
                          cursor: 'pointer',
                        }}
                        title="Haz clic para cambiar estado de pago"
                      >
                        {isPaid ? '🟢 Pagado' : '🔴 Pendiente'}
                      </button>
                    ) : (
                      <span
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          background: isPaid
                            ? 'rgba(46, 204, 113, 0.1)'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: isPaid ? '#2ecc71' : 'var(--text-muted)',
                        }}
                      >
                        {isPaid ? '🟢 Pagado' : 'Pendiente'}
                      </span>
                    )}

                    {/* Botón de Expulsar */}
                    {isAdmin && !m.isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleKick(m.userId, m.participantName)}
                        disabled={kickMutation.isPending}
                        className="glass-btn"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(231, 76, 60, 0.1)',
                          color: '#ff7675',
                          border: '1px solid rgba(231, 76, 60, 0.3)',
                          cursor: 'pointer',
                        }}
                        title="Expulsar de la liga"
                        aria-label={`Expulsar a ${m.participantName}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
