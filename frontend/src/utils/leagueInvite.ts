import toast from 'react-hot-toast';

/** Enlace que abre la invitación a una liga. */
export const joinLink = (code: string) =>
  `${window.location.origin}/join/${encodeURIComponent(code)}`;

/** Copia un texto y lo confirma con un aviso; si el navegador no deja, lo dice. */
export async function copyWithToast(text: string, success: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Portapapeles no disponible');
    await navigator.clipboard.writeText(text);
    toast.success(success);
  } catch {
    toast.error('No se pudo copiar. Cópialo a mano.');
  }
}

/**
 * Comparte solo el enlace: WhatsApp genera la vista previa con los metadatos OG, exactamente igual
 * que al pegar la URL a mano.
 */
export function shareJoinLinkOnWhatsApp(code: string) {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(joinLink(code))}`,
    '_blank',
    'noopener,noreferrer',
  );
}
