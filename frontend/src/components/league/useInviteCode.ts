import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { regenerateGroupJoinCode } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import { errorMessage } from '../../utils/errors';

export type CopyTarget = 'code' | 'link';

interface InviteCodeOptions {
  groupId: number;
  groupName: string;
  currentJoinCode: string | null | undefined;
  onCodeRegenerated: (newCode: string) => void;
  setActionError: (message: string) => void;
}

/** Código y enlace de invitación de una liga: copiar, compartir y regenerar. */
export function useInviteCode({
  groupId,
  groupName,
  currentJoinCode,
  onCodeRegenerated,
  setActionError,
}: InviteCodeOptions) {
  const queryClient = useQueryClient();
  const [activeCode, setActiveCode] = useState(currentJoinCode || '');
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | ''>('');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  useEffect(() => {
    setActiveCode(currentJoinCode || '');
  }, [currentJoinCode]);

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateGroupJoinCode(groupId),
    onMutate: () => setActionError(''),
    onSuccess: (data) => {
      setConfirmRegenerate(false);
      if (data.joinCode) {
        setActiveCode(data.joinCode);
        onCodeRegenerated?.(data.joinCode);
      }
      // El código se muestra en la tarjeta (myGroups) y en los detalles de la liga.
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      toast.success('Código de invitación regenerado');
    },
    onError: (err) => {
      const message = errorMessage(err, 'No se pudo regenerar el código.');
      setActionError(message);
      toast.error(message);
    },
  });

  const markCopied = (target: CopyTarget) => {
    setCopiedTarget(target);
    clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedTarget(''), 2200);
  };

  const copyText = async (text: string, target: CopyTarget, message: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard no disponible');
      await navigator.clipboard.writeText(text);
      markCopied(target);
      toast.success(message);
    } catch {
      setActionError('No se pudo copiar automáticamente. Copia el código manualmente.');
    }
  };

  const inviteLink = `${window.location.origin}/join/${encodeURIComponent(activeCode)}`;

  const handleShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Liga ${groupName}`,
          text: `Únete a la liga "${groupName}"`,
          url: inviteLink,
        });
        return;
      } catch (err) {
        // Cancelar el diálogo nativo no debe copiar el enlace por sorpresa.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copyText(inviteLink, 'link', 'Enlace de invitación copiado');
  };

  return {
    activeCode,
    copiedTarget,
    copyText,
    handleShare,
    inviteLink,
    regenerateMutation,
    confirmRegenerate,
    setConfirmRegenerate,
  };
}
