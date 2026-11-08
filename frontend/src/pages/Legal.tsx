import { Link } from 'react-router-dom';
import { resetAnalyticsConsent } from '../services/analytics';

const CONTACT_EMAIL = 'raclosdev@gmail.com';
const UPDATED_AT = '6 de noviembre de 2026';

interface LegalProps {
  kind: 'privacy' | 'legal';
}

/** Política de privacidad y aviso legal: páginas públicas, accesibles sin sesión. */
export default function Legal({ kind }: LegalProps) {
  const title = kind === 'privacy' ? 'Política de privacidad' : 'Aviso legal';

  return (
    <article className="paper-panel album-sheet max-w-3xl mx-auto my-6 px-6 py-8 text-left leading-[1.6] [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:font-bold [&_h2]:text-[1.15rem] [&_ul]:list-disc [&_ul]:pl-6 [&_p]:mb-3">
      <h1 className="poster-title text-[1.8rem] mb-1">{title}</h1>
      <p className="text-muted text-[0.9rem]">Última actualización: {UPDATED_AT}</p>
      {kind === 'privacy' ? <PrivacyContent /> : <LegalNoticeContent />}
      <nav className="mt-8 flex flex-wrap gap-4 text-[0.9rem]" aria-label="Información legal">
        <Link
          to={kind === 'privacy' ? '/aviso-legal' : '/privacidad'}
          className="underline inline-flex items-center min-h-11"
        >
          {kind === 'privacy' ? 'Aviso legal' : 'Política de privacidad'}
        </Link>
        <Link to="/" className="underline inline-flex items-center min-h-11">
          Volver a PorrApp
        </Link>
      </nav>
    </article>
  );
}

function ContactLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
      {CONTACT_EMAIL}
    </a>
  );
}

function PrivacyContent() {
  return (
    <>
      <h2>Responsable</h2>
      <p>
        El responsable del tratamiento es el titular de PorrApp. Puedes escribirle para cualquier
        cuestión sobre tus datos a <ContactLink />.
      </p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>
          Si entras con Google: email e identificador de tu cuenta de Google. Tu nombre de Google
          solo se usa para proponerte el nombre público al registrarte y no se guarda. Nunca
          recibimos tu contraseña de Google.
        </li>
        <li>
          Si te registras con email: tu email y un resumen cifrado (hash) de tu contraseña, del que
          no se puede sacar la contraseña.
        </li>
        <li>El nombre público y la foto de perfil que elijas.</li>
        <li>
          Tus ligas, tus predicciones, tus puntos y el estado de pago que marque el administrador de
          cada liga. PorrApp no cobra ni gestiona dinero.
        </li>
        <li>
          Si activas los avisos, la suscripción push de tu navegador y tus preferencias de avisos.
        </li>
        <li>
          Si añades una llave de acceso, su clave pública, el nombre del dispositivo y cuándo la
          añadiste y la usaste por última vez. Tu Face ID, huella o PIN nunca salen del dispositivo.
        </li>
        <li>
          Datos técnicos imprescindibles: la sesión (una cookie que caduca a los 30 días), el día de
          tu última entrada (para el plazo de conservación) y la dirección IP, que se usa de forma
          temporal para limitar abusos. Si la aplicación falla en tu navegador, se envía el error
          técnico (mensaje, traza y página, sin datos de tu cuenta) para poder corregirlo.
        </li>
        <li>
          Solo si aceptas la analítica: datos de uso que recoge Google Analytics (páginas que ves,
          tipo de dispositivo y navegador, país o ciudad aproximados y de dónde llegas), asociados a
          un identificador aleatorio de tu navegador, no a tu cuenta.
        </li>
      </ul>

      <h2>Para qué y con qué base</h2>
      <ul>
        <li>
          Prestarte el servicio (cuenta, ligas, predicciones y clasificaciones): ejecución del
          servicio que solicitas al registrarte (art. 6.1.b RGPD).
        </li>
        <li>
          Enviarte avisos push: tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier
          momento desde los ajustes de avisos o del navegador.
        </li>
        <li>Proteger el servicio frente a abusos: interés legítimo (art. 6.1.f RGPD).</li>
        <li>
          Medir cuánta gente usa PorrApp y qué mejorar con Google Analytics: tu consentimiento (art.
          6.1.a RGPD), que puedes retirar cuando quieras desde el botón de esta página.
        </li>
      </ul>
      <p>No hacemos perfiles, no vendemos datos y ahora mismo no mostramos publicidad.</p>

      <h2>Quién ve tus datos</h2>
      <ul>
        <li>
          Los miembros de tus ligas ven tu nombre público, tu foto, tus predicciones (las de cada
          partido, solo cuando empieza) y tus puntos. Nadie más ve tu email, tampoco el
          administrador de la liga.
        </li>
        <li>
          Proveedores que tratan datos por cuenta de PorrApp: Railway (alojamiento y base de datos)
          y Google (inicio de sesión; su código solo se carga cuando abres el botón de «Continuar
          con Google») y, solo si aceptas la analítica, Google Analytics, sin compartir los datos
          con otros servicios de Google ni usarlos para publicidad. Los servicios de avisos push del
          navegador (Google, Apple o Mozilla) solo reciben el aviso cifrado.
        </li>
        <li>
          Algunos de estos proveedores están en EE. UU. Las transferencias se amparan en el Marco de
          Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo de la Comisión Europea.
        </li>
      </ul>

      <h2>Almacenamiento en tu navegador</h2>
      <p>
        Usamos una cookie de sesión y el almacenamiento local del navegador para recordar tu sesión,
        tu liga activa, los borradores de tus predicciones y tu elección sobre la analítica. Son
        necesarios para que la app funcione, no sirven para seguirte y no requieren consentimiento.
      </p>
      <p>
        Si aceptas la analítica, Google Analytics guarda las cookies <code>_ga</code> y{' '}
        <code>_ga_*</code> para distinguir visitas, durante un máximo de 2 años. Si la rechazas, no
        se carga ningún código de Google Analytics. No usamos cookies de publicidad.
      </p>
      <p>
        <button type="button" onClick={resetAnalyticsConsent} className="glass-btn px-[15px] py-2">
          Cambiar mi elección sobre la analítica
        </button>
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas cuenta. Si pasas 24 meses sin entrar, borramos la cuenta y todos sus datos;
        las ligas que administres con más miembros pasan al miembro más antiguo. Las sesiones
        caducadas se borran a diario y la suscripción de avisos de un navegador se borra en cuanto
        el navegador la da de baja. Si borras tu cuenta, se eliminan en ese momento tu perfil, tu
        foto, tus predicciones, tus ligas sin más miembros, tus avisos y tus sesiones.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes descargar una copia de tus datos en <strong>Perfil → Descargar mis datos</strong> y
        borrar tu cuenta y todos tus datos desde <strong>Perfil → Borrar mi cuenta</strong>. Para
        rectificar tus datos, oponerte a algún tratamiento o cualquier otra solicitud, escribe a{' '}
        <ContactLink />. Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la
        Agencia Española de Protección de Datos (
        <a href="https://www.aepd.es" className="underline" target="_blank" rel="noreferrer">
          aepd.es
        </a>
        ).
      </p>

      <h2>Edad mínima</h2>
      <p>Para usar PorrApp tienes que tener al menos 14 años.</p>
    </>
  );
}

function LegalNoticeContent() {
  return (
    <>
      <h2>Titular</h2>
      <p>
        PorrApp es un proyecto personal sin ánimo de lucro. Contacto: <ContactLink />.
      </p>

      <h2>Objeto</h2>
      <p>
        PorrApp permite crear ligas privadas entre amigos y hacer predicciones sobre resultados
        deportivos. Es un juego: no es una casa de apuestas, no admite dinero y no reparte premios.
        Si una liga acuerda un bote entre sus miembros, lo gestionan ellos fuera de PorrApp.
      </p>

      <h2>Uso</h2>
      <p>
        Al usar PorrApp te comprometes a no suplantar a otras personas, a no subir contenido ilícito
        u ofensivo como nombre o foto de perfil o de liga, y a no intentar acceder a datos de otras
        cuentas. Podemos retirar contenido o cuentas que incumplan estas normas.
      </p>

      <h2>Resultados y responsabilidad</h2>
      <p>
        Los resultados, horarios y estadísticas se obtienen de fuentes públicas y pueden tener
        errores o retrasos. PorrApp se ofrece tal cual, sin garantía de disponibilidad continua.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Los nombres, escudos y marcas de competiciones y equipos pertenecen a sus titulares y se
        usan solo para identificarlos.
      </p>

      <h2>Datos personales</h2>
      <p>
        Consulta la{' '}
        <Link to="/privacidad" className="underline">
          política de privacidad
        </Link>
        .
      </p>
    </>
  );
}
