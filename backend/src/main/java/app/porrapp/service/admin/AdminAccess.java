package app.porrapp.service.admin;

import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decide quién puede usar el panel de administración: las cuentas cuyo email esté en
 * {@code app.admin.emails} (variable ADMIN_EMAILS, separados por comas) y que hayan entrado con Google o
 * Apple, que verifican el email; una cuenta de email y contraseña no vale. Sin configurar, nadie entra.
 * A cualquier otra persona se le responde 404, como si la ruta no existiera.
 */
@Component
public class AdminAccess {

    private final Set<String> adminEmails;
    private final UserAccountRepository users;

    public AdminAccess(@Value("${app.admin.emails:}") String emails, UserAccountRepository users) {
        this.adminEmails = Arrays.stream(emails.split(","))
                .map(e -> e.trim().toLowerCase(Locale.ROOT))
                .filter(e -> !e.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
        this.users = users;
    }

    /** @throws ResponseStatusException 404 si quien llama no es administrador. */
    public void requireAdmin(String email) {
        if (!isAdmin(email)) {
            throw notFound();
        }
    }

    /** Si la cuenta es de administrador; no lanza, para poder avisar a la propia interfaz. */
    public boolean isAdmin(String email) {
        if (email == null || !adminEmails.contains(email.trim().toLowerCase(Locale.ROOT))) {
            return false;
        }
        return users.findByGoogleEmail(email)
                .map(a -> a.getGoogleSub() != null || a.getAppleSub() != null)
                .orElse(false);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
}
