package com.porra.mundial.config;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.Team;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.repository.BetRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.service.HashTransitionService;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.Edition;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Componente que inicializa la base de datos la primera vez que se levanta la aplicación.
 * Implementa {@link CommandLineRunner} para ejecutarse automáticamente justo después
 * de que el contexto de Spring se haya cargado.
 * <p>
 * Responsabilidades:
 * 1. Insertar los 48 equipos del Mundial 2026 junto con sus cuotas iniciales (Win, Qualify, Outright).
 * 2. Migrar las apuestas legacy en Base64 (hashes) a la nueva estructura relacional de la BD.
 * </p>
 */
@Component
@Transactional
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final TeamRepository teamRepository;
    private final BetRepository betRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final HashTransitionService hashTransitionService;

    /**
     * Método principal que arranca con Spring Boot.
     * 
     * @param args Argumentos de la línea de comandos (no se usan).
     */
    @Override
    public void run(String... args) {
        // Validación para evitar duplicar datos en reinicios del servidor.
        if (teamRepository.count() > 0) {
            log.info("Database already seeded with {} teams, skipping initialization.", teamRepository.count());
            return;
        }

        log.info("Seeding database with World Cup 2026 teams...");

        // Insertando todos los equipos ordenados por grupo (A-L).
        // Los valores son: Nombre, Grupo, Cuota de ganar partido, Cuota clasificar, Cuota ganar mundial.
        
        // Group A
        seedTeam("México", "A", 1.72, 1.10, 67.00);
        seedTeam("Sudáfrica", "A", 13.00, 2.25, 1001.00);
        seedTeam("Corea del Sur", "A", 4.33, 1.36, 401.00);
        seedTeam("Chequia", "A", 4.33, 1.36, 301.00);

        // Group B
        seedTeam("Canadá", "B", 3.00, 1.14, 126.00);
        seedTeam("Bosnia y Her.", "B", 6.00, 1.44, 351.00);
        seedTeam("Catar", "B", 34.00, 4.00, 2001.00);
        seedTeam("Suiza", "B", 1.72, 1.083, 81.00);

        // Group C
        seedTeam("Brasil", "C", 1.25, 1.01, 9.00);
        seedTeam("Marruecos", "C", 4.50, 1.12, 51.00);
        seedTeam("Haití", "C", 101.00, 9.00, 2501.00);
        seedTeam("Escocia", "C", 13.00, 1.36, 251.00);

        // Group D
        seedTeam("EEUU", "D", 2.37, 1.14, 67.00);
        seedTeam("Paraguay", "D", 4.75, 1.50, 151.00);
        seedTeam("Australia", "D", 8.00, 1.90, 501.00);
        seedTeam("Turquía", "D", 2.75, 1.25, 81.00);

        // Group E
        seedTeam("Alemania", "E", 1.28, 1.015, 15.00);
        seedTeam("Curaçao", "E", 101.00, 10.00, 3501.00);
        seedTeam("Costa de Marfil", "E", 8.00, 1.22, 301.00);
        seedTeam("Ecuador", "E", 4.50, 1.10, 101.00);

        // Group F
        seedTeam("Países Bajos", "F", 1.72, 1.071, 21.00);
        seedTeam("Japón", "F", 3.75, 1.25, 51.00);
        seedTeam("Suecia", "F", 5.50, 1.44, 126.00);
        seedTeam("Túnez", "F", 11.00, 2.62, 501.00);

        // Group G
        seedTeam("Bélgica", "G", 1.36, 1.03, 34.00);
        seedTeam("Egipto", "G", 5.00, 1.36, 301.00);
        seedTeam("Irán", "G", 7.00, 1.50, 501.00);
        seedTeam("Nueva Zelanda", "G", 26.00, 2.75, 2501.00);

        // Group H
        seedTeam("España", "H", 1.20, 1.01, 5.50);
        seedTeam("Cabo Verde", "H", 41.00, 2.62, 2001.00);
        seedTeam("Arabia Saudí", "H", 21.00, 2.25, 1001.00);
        seedTeam("Uruguay", "H", 5.00, 1.12, 67.00);

        // Group I
        seedTeam("Francia", "I", 1.40, 1.04, 6.00);
        seedTeam("Senegal", "I", 8.00, 1.40, 126.00);
        seedTeam("Irak", "I", 51.00, 4.00, 1501.00);
        seedTeam("Noruega", "I", 3.80, 1.16, 26.00);

        // Group J
        seedTeam("Argentina", "J", 1.33, 1.02, 10.00);
        seedTeam("Argelia", "J", 7.00, 1.36, 401.00);
        seedTeam("Austria", "J", 5.00, 1.16, 151.00);
        seedTeam("Jordania", "J", 41.00, 3.40, 2501.00);

        // Group K
        seedTeam("Portugal", "K", 1.44, 1.03, 9.00);
        seedTeam("RD Congo", "K", 15.00, 2.10, 751.00);
        seedTeam("Uzbekistán", "K", 34.00, 2.62, 1501.00);
        seedTeam("Colombia", "K", 3.00, 1.12, 34.00);

        // Group L
        seedTeam("Inglaterra", "L", 1.28, 1.015, 7.50);
        seedTeam("Croacia", "L", 4.50, 1.22, 81.00);
        seedTeam("Ghana", "L", 11.00, 1.72, 401.00);
        seedTeam("Panamá", "L", 51.00, 2.75, 1501.00);

        log.info("Seeded {} teams successfully!", teamRepository.count());

        // Una vez insertados los equipos, procesamos las apuestas antiguas en formato hash Base64.
        if (betRepository.count() == 0) {
            seedExistingBets();
        }
    }

    /**
     * Construye un objeto Team y lo guarda en la base de datos usando JPA.
     * 
     * @param name Nombre oficial en español
     * @param group Letra del grupo (A-L)
     * @param win Cuota para ganar el próximo partido
     * @param qualify Cuota para clasificar a la siguiente ronda
     * @param outright Cuota para salir campeón del mundo
     */
    private void seedTeam(String name, String group, double win, double qualify, double outright) {
        Team team = Team.builder()
                .name(name)
                .groupName(group)
                .winOdds(win)
                .qualifyOdds(qualify)
                .outrightOdds(outright)
                .build();
        teamRepository.save(team);
    }

    /**
     * Procesa los hashes en Base64 procedentes del antiguo participants.js.
     * Decodifica el JSON, crea los usuarios, vincula sus apuestas a la edición GLOBAL (ID=1)
     * y utiliza el HashTransitionService para rellenar todas las tablas relacionales.
     */
    private void seedExistingBets() {
        // Hashes en Base64 de las apuestas iniciales importadas
        String[] hashes = {
            "eyJ1c2VyIjoiQW7Ds25pbW8iLCJiZXQiOiJBcHVlc3RhXzEiLCJzY29yZXIiOiJLeWxpYW4gTWJhcHDDqSAoRlJBKSIsImdyb3VwcyI6eyJBIjpbIk3DqXhpY28iLCJDb3JlYSBkZWwgU3VyIiwiQ2hlcXVpYSJdLCJCIjpbIlN1aXphIiwiQ2FuYWTDoSIsIkJvc25pYSB5IEhlci4iXSwiQyI6WyJCcmFzaWwiLCJNYXJydWVjb3MiLCJFc2NvY2lhIl0sIkQiOlsiRUVVVSIsIlR1cnF1w61hIiwiUGFyYWd1YXkiXSwiRSI6WyJBbGVtYW5pYSIsIkVjdWFkb3IiLCJDb3N0YSBkZSBNYXJmaWwiXSwiRiI6WyJQYcOtc2VzIEJham9zIiwiSmFww7NuIiwiU3VlY2lhIl0sIkciOlsiQsOpbGdpY2EiLCJFZ2lwdG8iLCJJcsOhbiJdLCJIIjpbIkVzcGHDsWEiLCJVcnVndWF5IiwiQXJhYmlhIFNhdWTDrSJdLCJJIjpbIkZyYW5jaWEiLCJOb3J1ZWdhIiwiU2VuZWdhbCJdLCJKIjpbIkFyZ2VudGluYSIsIkF1c3RyaWEiLCJBcmdlbGlhIl0sIksiOlsiUG9ydHVnYWwiLCJDb2xvbWJpYSIsIlJEIENvbmdvIl0sIkwiOlsiSW5nbGF0ZXJyYSIsIkNyb2FjaWEiLCJHaGFuYSJdfSwidGhpcmRzIjpbIkNoZXF1aWEiLCJCb3NuaWEgeSBIZXIuIiwiRXNjb2NpYSIsIlBhcmFndWF5IiwiQ29zdGEgZGUgTWFyZmlsIiwiU3VlY2lhIiwiU2VuZWdhbCIsIkFyZ2VsaWEiXSwicjE2IjpbWyJBbGVtYW5pYSIsIkZyYW5jaWEiXSxbIkNvcmVhIGRlbCBTdXIiLCJQYcOtc2VzIEJham9zIl0sWyJDcm9hY2lhIiwiQXVzdHJpYSJdLFsiQm9zbmlhIHkgSGVyLiIsIkLDqWxnaWNhIl0sWyJCcmFzaWwiLCJFY3VhZG9yIl0sWyJNw6l4aWNvIiwiSW5nbGF0ZXJyYSJdLFsiQXJnZW50aW5hIiwiVHVycXXDrWEiXSxbIlN1aXphIiwiUG9ydHVnYWwiXV0sInFmIjpbWyJBbGVtYW5pYSIsIkNvcmVhIGRlbCBTdXIiXSxbIkNyb2FjaWEiLCJCb3NuaWEgeSBIZXIuIl0sWyJFY3VhZG9yIiwiTcOpeGljbyJdLFsiQXJnZW50aW5hIiwiU3VpemEiXV0sInNmIjpbWyJBbGVtYW5pYSIsIkNyb2FjaWEiXSxbIk3DqXhpY28iLCJBcmdlbnRpbmEiXV0sImZpbmFsIjpbIkFsZW1hbmlhIiwiTcOpeGljbyJdLCJjaGFtcGlvbiI6IkFsZW1hbmlhIiwidGhpcmRQbGFjZU1hdGNoIjpbIkNyb2FjaWEiLCJBcmdlbnRpbmEiXSwidGhpcmRQbGFjZVdpbm5lciI6IkNyb2FjaWEifQ==",
            "eyJ1c2VyIjoiQ2FybG9zIiwiYmV0IjoiTGxvcmVudGFkYSIsInNjb3JlciI6Ikt5bGlhbiBNYmFwcMOpIChGUkEpIiwiZ3JvdXBzIjp7IkEiOlsiTcOpeGljbyIsIkNvcmVhIGRlbCBTdXIiLCJDaGVxdWlhIl0sIkIiOlsiU3VpemEiLCJDYW5hZMOhIiwiQm9zbmlhIHkgSGVyLiJdLCJDIjpbIkJyYXNpbCIsIk1hcnJ1ZWNvcyIsIkVzY29jaWEiXSwiRCI6WyJFRVVVIiwiVHVycXXDrWEiLCJQYXJhZ3VheSJdLCJFIjpbIkFsZW1hbmlhIiwiRWN1YWRvciIsIkNvc3RhIGRlIE1hcmZpbCJdLCJGIjpbIlBhw61zZXMgQmFqb3MiLCJKYXDDs24iLCJTdWVjaWEiXSwiRyI6WyJCw6lsZ2ljYSIsIkVnaXB0byIsIklyw6FuIl0sIkgiOlsiRXNwYcOxYSIsIlVydWd1YXkiLCJBcmFiaWEgU2F1ZMOtIl0sIkkiOlsiRnJhbmNpYSIsIk5vcnVlZ2EiLCJTZW5lZ2FsIl0sIkoiOlsiQXJnZW50aW5hIiwiQXVzdHJpYSIsIkFyZ2VsaWEiXSwiSyI6WyJQb3J0dWdhbCIsIkNvbG9tYmlhIiwiUkQgQ29uZ28iXSwiTCI6WyJJbmdsYXRlcnJhIiwiQ3JvYWNpYSIsIkdoYW5hIl19LCJ0aGlyZHMiOlsiQ2hlcXVpYSIsIkJvc25pYSB5IEhlci4iLCJFc2NvY2lhIiwiUGFyYWd1YXkiLCJDb3N0YSBkZSBNYXJmaWwiLCJTdWVjaWEiLCJTZW5lZ2FsIiwiQXJnZWxpYSJdLCJyMTYiOltbIlBhcmFndWF5IiwiU3VlY2lhIl0sWyJDYW5hZMOhIiwiUGHDrXNlcyBCYWpvcyJdLFsiQ29sb21iaWEiLCJBdXN0cmlhIl0sWyJFRVVVIiwiQsOpbGdpY2EiXSxbIkphcMOzbiIsIk5vcnVlZ2EiXSxbIkVzY29jaWEiLCJTZW5lZ2FsIl0sWyJVcnVndWF5IiwiVHVycXXDrWEiXSxbIlN1aXphIiwiUG9ydHVnYWwiXV0sInFmIjpbWyJQYXJhZ3VheSIsIkNhbmFkw6EiXSxbIkF1c3RyaWEiLCJFRVVVIl0sWyJKYXDDs24iLCJTZW5lZ2FsIl0sWyJVcnVndWF5IiwiU3VpemEiXV0sInNmIjpbWyJQYXJhZ3VheSIsIkF1c3RyaWEiXSxbIlNlbmVnYWwiLCJTdWl6YSJdXSwiZmluYWwiOlsiUGFyYWd1YXkiLCJTdWl6YSJdLCJjaGFtcGlvbiI6IlBhcmFndWF5IiwidGhpcmRQbGFjZU1hdGNoIjpbIkF1c3RyaWEiLCJTZW5lZ2FsIl0sInRoaXJkUGxhY2VXaW5uZXIiOiJBdXN0cmlhIn0=",
            "eyJ1c2VyIjoiZGZzZGYiLCJiZXQiOiJmZHNmc2RmcyIsInNjb3JlciI6IlJvZHJ5Z28iLCJncm91cHMiOnsiQSI6WyJDaGVxdWlhIiwiQ29yZWEgZGVsIFN1ciIsIk3DqXhpY28iXSwiQiI6WyJDYXRhciIsIlN1aXphIiwiQ2FuYWTDoSJdLCJDIjpbIkJyYXNpbCIsIk1hcnJ1ZWNvcyIsIkVzY29jaWEiXSwiRCI6WyJQYXJhZ3VheSIsIlR1cnF1w61hIiwiRUVVVSJdLCJFIjpbIkNvc3RhIGRlIE1hcmZpbCIsIkN1cmHDp2FvIiwiQWxlbWFuaWEiXSwiRiI6WyJKYXDDs24iLCJQYcOtc2VzIEJham9zIiwiU3VlY2lhIl0sIkciOlsiTnVldmEgWmVsYW5kYSIsIkVnaXB0byIsIklyw6FuIl0sIkgiOlsiRXNwYcOxYSIsIlVydWd1YXkiLCJBcmFiaWEgU2F1ZMOtIl0sIkkiOlsiTm9ydWVnYSIsIklyYWsiLCJTZW5lZ2FsIl0sIkoiOlsiQXVzdHJpYSIsIkFyZ2VsaWEiLCJKb3JkYW5pYSJdLCJLIjpbIlBvcnR1Z2FsIiwiQ29sb21iaWEiLCJSRCBDb25nbyJdLCJMIjpbIkNyb2FjaWEiLCJHaGFuYSIsIkluZ2xhdGVycmEiXX0sInRoaXJkcyI6WyJNw6l4aWNvIiwiQ2FuYWTDoSIsIkVFVVUiLCJTdWVjaWEiLCJJcsOhbiIsIkFyYWJpYSBTYXVkw60iLCJTZW5lZ2FsIiwiUkQgQ29uZ28iXSwicjE2IjpbWyJDb3N0YSBkZSBNYXJmaWwiLCJOb3J1ZWdhIl0sWyJTdWl6YSIsIk1hcnJ1ZWNvcyJdLFsiQ29sb21iaWEiLCJFc3Bhw7FhIl0sWyJQYXJhZ3VheSIsIk51ZXZhIFplbGFuZGEiXSxbIkJyYXNpbCIsIkN1cmHDp2FvIl0sWyJBcmFiaWEgU2F1ZMOtIiwiUkQgQ29uZ28iXSxbIlVydWd1YXkiLCJFZ2lwdG8iXSxbIkNhdGFyIiwiUG9ydHVnYWwiXV0sInFmIjpbWyJDb3N0YSBkZSBNYXJmaWwiLCJNYXJydWVjb3MiXSxbIkNvbG9tYmlhIiwiTnVldmEgWmVsYW5kYSJdLFsiQnJhc2lsIiwiQXJhYmlhIFNhdWTDrSJdLFsiRWdpcHRvIiwiUG9ydHVnYWwiXV0sInNmIjpbWyJNYXJydWVjb3MiLCJOdWV2YSBaZWxhbmRhIl0sWyJCcmFzaWwiLCJFZ2lwdG8iXV0sImZpbmFsIjpbIk51ZXZhIFplbGFuZGEiLCJFZ2lwdG8iXSwiY2hhbXBpb24iOiJFZ2lwdG8iLCJ0aGlyZFBsYWNlTWF0Y2giOlsiTWFycnVlY29zIiwiQnJhc2lsIl0sInRoaXJkUGxhY2VXaW5uZXIiOiJNYXJydWVjb3MifQ=="
        };

        // Arrays de mapeo directo usuario -> nombre_apuesta
        String[][] betInfo = {
            {"Anónimo", "Apuesta_1"},
            {"Carlos", "Llorentada"},
            {"dfsdf", "fdsfsdfs"}
        };

        // Las apuestas legacy se atan siempre a la liga/edición por defecto "ACTIVE" con ID 1
        Edition globalEdition = editionRepository.findByLeagueIdAndStatus(1L, "ACTIVE").orElse(null);

        // Bucle iterativo de creación y descifrado
        for (int i = 0; i < hashes.length; i++) {
            final String pName = betInfo[i][0];
            
            // Busca la cuenta del usuario o la crea "al vuelo" si no existe
            UserAccount user = userAccountRepository.findByParticipantName(pName)
                .orElseGet(() -> userAccountRepository.save(UserAccount.builder()
                        .googleEmail(pName + "@local")
                        .googleName(pName)
                        .participantName(pName)
                        .build()));

            // Crea el registro cabecera de la Apuesta (Tabla 'bets')
            Bet bet = Bet.builder()
                    .user(user)
                    .edition(globalEdition)
                    .betName(betInfo[i][1])
                    .paymentStatus("PAID") // Todos los legacy están pagados por defecto
                    .build();
            bet = betRepository.save(bet);
            
            // Proceso crítico: Decodificar el Base64 y delegar la transposición
            try {
                String decoded = new String(java.util.Base64.getDecoder().decode(hashes[i]), java.nio.charset.StandardCharsets.UTF_8);
                ObjectMapper mapper = new ObjectMapper();
                // Parsea el string en un DTO con la estructura antigua del bracket
                BetDataDTO dto = mapper.readValue(decoded, BetDataDTO.class);
                // Llama al servicio que descompone el DTO y guarda registros en bracket_predictions, group_predictions, etc.
                hashTransitionService.saveRelationalPredictions(bet, dto);
            } catch (Exception e) {
                log.error("Failed to parse initial bet data", e);
            }
        }

        log.info("Seeded {} existing bets.", hashes.length);
    }
}
