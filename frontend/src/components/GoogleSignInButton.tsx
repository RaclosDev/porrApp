import { GoogleLogin, GoogleOAuthProvider, type GoogleLoginProps } from '@react-oauth/google';

const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '498045926443-u02u6penjkggongduv26qlm7934449ee.apps.googleusercontent.com';

/**
 * Botón de «Continuar con Google» con su propio proveedor: el SDK de Google (que envía IP y navegador a
 * Google y deja la cookie g_state) solo se carga cuando se pinta un botón de inicio de sesión, no en
 * todas las páginas.
 *
 * Con FedCM, quien ya entró con su cuenta de Google ve «Continuar como …» con su nombre y foto
 * aunque el navegador bloquee las cookies de terceros (Chrome, Edge). Safari no tiene FedCM ni deja
 * a Google leer su sesión desde otra web, así que allí sigue el botón genérico.
 */
export default function GoogleSignInButton(props: GoogleLoginProps) {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <GoogleLogin use_fedcm_for_button {...props} />
    </GoogleOAuthProvider>
  );
}
