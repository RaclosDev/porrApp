package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;


/**
 * Entidad 'UserAccount'.
 * Guarda la relación entre una cuenta de Google (email) y el nombre de participante en la porra.
 */
@Entity
@Table(name = "app_users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAccount {

    /**
     * Cuenta interna "Admin" del sistema (administra la antigua Porra Global). Ningún login de
     * Google puede devolver este email, así que solo el servidor actúa en su nombre.
     */
    public static final String SYSTEM_ADMIN_EMAIL = "admin@local";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Identificador de la cuenta de Google (claim "sub"). Es lo que identifica al usuario al
     * iniciar sesión; null en las cuentas que no han vuelto a entrar desde que se guarda.
     */
    @Column(name = "google_sub", unique = true)
    private String googleSub;

    /** Identificador de la cuenta de Apple (claim "sub"); null si nunca ha entrado con Apple. */
    @Column(name = "apple_sub", unique = true)
    private String appleSub;

    /**
     * Email de la cuenta (Ej: raclo@gmail.com): el verificado de Google, que se actualiza si cambia
     * en Google, o el que dio al registrarse con contraseña. El nombre es histórico.
     */
    @Column(nullable = false, unique = true)
    private String googleEmail;

    /**
     * Hash BCrypt de la contraseña de quien se registró con email y contraseña; null en las
     * cuentas de Google. Ese email no está verificado: si luego entra Google con él, la cuenta
     * pasa a Google y la contraseña se borra.
     */
    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    /** Ya no se rellena (minimización de datos); la columna se mantiene por compatibilidad. */
    private String googleName;

    /** El apodo o nombre visible con el que se identifica en el ranking y grupos (Ej: "Raclos"). */
    @Column(nullable = false)
    private String participantName;

    /** Fecha y hora en la que se registró por primera vez en la aplicación. */
    @Builder.Default
    private Instant linkedAt = Instant.now();

    /** Último inicio de sesión o refresco de sesión, con precisión de un día. Sirve para borrar cuentas inactivas. */
    @Column(name = "last_active_at", nullable = false)
    @Builder.Default
    private Instant lastActiveAt = Instant.now();

    /** 
     * ID del último grupo que tuvo seleccionado en el frontend.
     * Sirve para recordar sus preferencias al hacer F5 y que no se cambie de grupo.
     */
    @Column(name = "last_selected_group_id")
    private Long lastSelectedGroupId;

    /** Momento de la última subida de foto de perfil. Null si no tiene foto. Sirve para versionar la URL. */
    @Column(name = "avatar_updated_at")
    private Instant avatarUpdatedAt;

    /** Clave aleatoria de la URL de la foto; cambia en cada subida. */
    @Column(name = "avatar_key", length = 32)
    private String avatarKey;

    /** Recibe un aviso push una hora antes de que cierre un partido que aún no ha predicho. */
    @Column(name = "match_reminders_enabled", nullable = false)
    @Builder.Default
    private boolean matchRemindersEnabled = true;

    /** Recibe un aviso push cuando alguien se une a una de sus ligas. */
    @Column(name = "member_joined_alerts_enabled", nullable = false)
    @Builder.Default
    private boolean memberJoinedAlertsEnabled = true;

    /** Recibe un aviso push cuando termina una jornada de sus ligas, para ver cómo queda el ranking. */
    @Column(name = "matchday_finished_alerts_enabled", nullable = false)
    @Builder.Default
    private boolean matchdayFinishedAlertsEnabled = true;

    @Column(name = "profile_setup_completed", nullable = false)
    private boolean profileSetupCompleted;

    /** URL no adivinable de la foto de perfil, o null si no tiene. */
    @Transient
    public String getAvatarUrl() {
        if (id == null || avatarUpdatedAt == null || avatarKey == null) return null;
        return "/api/users/" + id + "/avatar/" + avatarKey;
    }
}
