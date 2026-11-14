package app.porrapp;

import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Un único PostgreSQL por JVM de test para las clases que revierten sus cambios (@DataJpaTest sin commit):
 * arrancar un contenedor por clase costaba ~3 s cada una y obligaba a Spring a crear un contexto nuevo cada vez.
 * Se arranca en la primera petición y lo elimina Ryuk al terminar la JVM.
 */
public final class SharedPostgres {

    private static PostgreSQLContainer<?> rollback;
    private static PostgreSQLContainer<?> committing;
    private static PostgreSQLContainer<?> integration;

    private SharedPostgres() {
    }

    /** Para clases cuyas transacciones se revierten: no dejan datos que otras puedan ver. */
    public static synchronized PostgreSQLContainer<?> rollback() {
        if (rollback == null) {
            rollback = start();
        }
        return rollback;
    }

    /** Para clases que confirman datos: comparten PostgreSQL entre sí, aparte de las que revierten. */
    public static synchronized PostgreSQLContainer<?> committing() {
        if (committing == null) {
            committing = start();
        }
        return committing;
    }

    /** Para las clases @SpringBootTest que comparten contexto: un solo PostgreSQL y un solo arranque de Spring. */
    public static synchronized PostgreSQLContainer<?> integration() {
        if (integration == null) {
            integration = start();
        }
        return integration;
    }

    private static PostgreSQLContainer<?> start() {
        PostgreSQLContainer<?> container = new PostgreSQLContainer<>("postgres:16-alpine")
                .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
                .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");
        container.start();
        return container;
    }
}
