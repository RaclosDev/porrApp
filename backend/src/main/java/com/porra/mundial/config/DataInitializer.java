package com.porra.mundial.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.GroupStandingRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.PredictionPersistenceService;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;

/**
 * Componente que inicializa la base de datos la primera vez que se levanta la aplicacion.
 */
@Component
@Transactional
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final TeamRepository teamRepository;
    private final PredictionRepository predictionRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final PredictionPersistenceService predictionPersistenceService;
    private final SyncService syncService;
    private final GroupStandingRepository standingRepository;
    private final MatchRepository matchRepository;
    private final CompetitionRepository competitionRepository;
    private final com.porra.mundial.service.StandingsService standingsService;

    @Override
    public void run(String... args) {
        seedCompetitionIfMissing("FIFA World Cup 2026", "fifa.world", "TOURNAMENT");
        seedCompetitionIfMissing("LaLiga EA Sports", "esp.1", "LEAGUE");
        seedCompetitionIfMissing("UEFA Champions League", "uefa.champions", "LEAGUE");
        seedCompetitionIfMissing("Premier League", "eng.1", "LEAGUE");

        if (teamRepository.findByName("Por definir").isEmpty()) {
            teamRepository.save(Team.builder()
                    .name("Por definir")
                    .nameEn("TBD")
                    .groupName("-")
                    .winOdds(1.0)
                    .qualifyOdds(1.0)
                    .outrightOdds(1.0)
                    .build());
        }

        try {
            syncService.syncAll();
        } catch (Exception e) {
            log.warn("Could not sync on startup: {}", e.getMessage());
        }

        try {
            standingsService.recalculateStandingsFromMatches();
        } catch (Exception e) {
            log.warn("Could not recalculate standings on startup: {}", e.getMessage());
        }

        try {
            syncService.propagateKnockoutWinners();
        } catch (Exception e) {
            log.warn("Could not propagate knockout winners on startup: {}", e.getMessage());
        }

        try {
            standingRepository.deleteByGroupName("-");
            standingRepository.deleteByGroupName("l");
            teamRepository.findAll().forEach(t -> {
                if (t.getGroupName() != null && !"Por definir".equalsIgnoreCase(t.getName()) && !"-".equals(t.getGroupName())) {
                    String upper = t.getGroupName().toUpperCase().trim();
                    if (!t.getGroupName().equals(upper)) {
                        t.setGroupName(upper);
                        teamRepository.save(t);
                    }
                }
            });
            matchRepository.findAll().forEach(m -> {
                if (m.getGroupName() != null && !"-".equals(m.getGroupName())) {
                    String upper = m.getGroupName().toUpperCase().trim();
                    if (!m.getGroupName().equals(upper)) {
                        m.setGroupName(upper);
                        matchRepository.save(m);
                    }
                }
            });
        } catch (Exception e) {
            log.warn("Could not sanitize group names on startup: {}", e.getMessage());
        }

        if (teamRepository.count() > 1) {
            log.info("Database already seeded with {} teams, skipping initialization.", teamRepository.count());
            return;
        }

        log.info("Seeding database with World Cup 2026 teams...");

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
        seedTeam("Escocia", "C", 13.00, 2.05, 751.00);
        seedTeam("Haití", "C", 41.00, 5.00, 2501.00);

        // Group D
        seedTeam("EEUU", "D", 1.75, 1.10, 67.00);
        seedTeam("Turquía", "D", 3.75, 1.30, 201.00);
        seedTeam("Paraguay", "D", 4.50, 1.40, 301.00);
        seedTeam("Nueva Caledonia", "D", 81.00, 9.00, 5001.00);

        // Group E
        seedTeam("Alemania", "E", 1.30, 1.02, 11.00);
        seedTeam("Ecuador", "E", 4.50, 1.25, 101.00);
        seedTeam("Costa de Marfil", "E", 8.00, 1.55, 251.00);
        seedTeam("Curaçao", "E", 51.00, 7.00, 3501.00);

        // Group F
        seedTeam("Países Bajos", "F", 1.40, 1.03, 17.00);
        seedTeam("Japón", "F", 4.00, 1.28, 126.00);
        seedTeam("Suecia", "F", 6.50, 1.44, 201.00);
        seedTeam("Túnez", "F", 15.00, 2.50, 1001.00);

        // Group G
        seedTeam("Bélgica", "G", 1.45, 1.04, 26.00);
        seedTeam("Egipto", "G", 5.00, 1.36, 201.00);
        seedTeam("Irán", "G", 7.00, 1.50, 301.00);
        seedTeam("Nueva Zelanda", "G", 19.00, 2.80, 1501.00);

        // Group H
        seedTeam("España", "H", 1.25, 1.01, 7.00);
        seedTeam("Uruguay", "H", 4.33, 1.15, 34.00);
        seedTeam("Arabia Saudí", "H", 13.00, 2.10, 751.00);
        seedTeam("Cabo Verde", "H", 34.00, 4.50, 2001.00);

        // Group I
        seedTeam("Francia", "I", 1.22, 1.005, 6.50);
        seedTeam("Noruega", "I", 5.00, 1.20, 51.00);
        seedTeam("Senegal", "I", 9.00, 1.60, 201.00);
        seedTeam("Irak", "I", 41.00, 5.50, 3001.00);

        // Group J
        seedTeam("Argentina", "J", 1.20, 1.005, 6.00);
        seedTeam("Austria", "J", 5.50, 1.25, 67.00);
        seedTeam("Argelia", "J", 11.00, 1.80, 401.00);
        seedTeam("Jordania", "J", 41.00, 6.00, 3501.00);

        // Group K
        seedTeam("Portugal", "K", 1.36, 1.025, 13.00);
        seedTeam("RD Congo", "K", 15.00, 2.40, 1001.00);
        seedTeam("Uzbekistán", "K", 15.00, 2.40, 1001.00);
        seedTeam("Colombia", "K", 3.00, 1.12, 34.00);

        // Group L
        seedTeam("Inglaterra", "L", 1.28, 1.015, 7.50);
        seedTeam("Croacia", "L", 4.50, 1.22, 81.00);
        seedTeam("Ghana", "L", 11.00, 1.72, 401.00);
        seedTeam("Panamá", "L", 51.00, 2.75, 1501.00);

        log.info("Seeded {} teams successfully!", teamRepository.count());

        if (predictionRepository.count() == 0) {
            seedExistingPredictions();
        }
    }

    private void seedCompetitionIfMissing(String name, String externalId, String formatType) {
        if (competitionRepository.findByExternalId(externalId).isEmpty() && competitionRepository.findByName(name).isEmpty()) {
            competitionRepository.save(com.porra.mundial.model.Competition.builder()
                    .name(name)
                    .externalId(externalId)
                    .formatType(formatType)
                    .build());
        }
    }

    private void seedTeam(String name, String group, double win, double qualify, double outright) {
        Team team = Team.builder()
                .name(name)
                .groupName(group != null && !"-".equals(group) ? group.toUpperCase().trim() : group)
                .winOdds(win)
                .qualifyOdds(qualify)
                .outrightOdds(outright)
                .build();
        teamRepository.save(team);
    }

    private void seedExistingPredictions() {
        String[] hashes = {
            "eyJ1c2VyIjoiQW7Ds25pbW8iLCJiZXQiOiJBcHVlc3RhXzEiLCJzY29yZXIiOiJLeWxpYW4gTWJhcHDDqSAoRlJBKSIsImdyb3VwcyI6eyJBIjpbIk3DqXhpY28iLCJDb3JlYSBkZWwgU3VyIiwiQ2hlcXVpYSJdLCJCIjpbIlN1aXphIiwiQ2FuYWTDoSIsIkJvc25pYSB5IEhlci4iXSwiQyI6WyJCcmFzaWwiLCJNYXJydWVjb3MiLCJFc2NvY2lhIl0sIkQiOlsiRUVVVSIsIlR1cnF1w61hIiwiUGFyYWd1YXkiXSwiRSI6WyJBbGVtYW5pYSIsIkVjdWFkb3IiLCJDb3N0YSBkZSBNYXJmaWwiXSwiRiI6WyJQYcOtc2VzIEJham9zIiwiSmFww7NuIiwiU3VlY2lhIl0sIkciOlsiQsOpbGdpY2EiLCJFZ2lwdG8iLCJJcsOhbiJdLCJIIjpbIkVzcGHDsWEiLCJVcnVndWF5IiwiQXJhYmlhIFNhdWTDrSJdLCJJIjpbIkZyYW5jaWEiLCJOb3J1ZWdhIiwiU2VuZWdhbCJdLCJKIjpbIkFyZ2VudGluYSIsIkF1c3RyaWEiLCJBcmdlbGlhIl0sIksiOlsiUG9ydHVnYWwiLCJDb2xvbWJpYSIsIlJEIENvbmdvIl0sIkwiOlsiSW5nbGF0ZXJyYSIsIkNyb2FjaWEiLCJHaGFuYSJdfSwidGhpcmRzIjpbIkNoZXF1aWEiLCJCb3NuaWEgeSBIZXIuIiwiRXNjb2NpYSIsIlBhcmFndWF5IiwiQ29zdGEgZGUgTWFyZmlsIiwiU3VlY2lhIiwiU2VuZWdhbCIsIkFyZ2VsaWEiXSwicjE2IjpbWyJBbGVtYW5pYSIsIkZyYW5jaWEiXSxbIkNvcmVhIGRlbCBTdXIiLCJQYcOtc2VzIEJham9zIl0sWyJDcm9hY2lhIiwiQXVzdHJpYSJdLFsiQm9zbmlhIHkgSGVyLiIsIkLDqWxnaWNhIl0sWyJCcmFzaWwiLCJFY3VhZG9yIl0sWyJNw6l4aWNvIiwiSW5nbGF0ZXJyYSJdLFsiQXJnZW50aW5hIiwiVHVycXXDrWEiXSxbIlN1aXphIiwiUG9ydHVnYWwiXV0sInFmIjpbWyJBbGVtYW5pYSIsIkNvcmVhIGRlbCBTdXIiXSxbIkNyb2FjaWEiLCJCb3NuaWEgeSBIZXIuIl0sWyJFY3VhZG9yIiwiTcOpeGljbyJdLFsiQXJnZW50aW5hIiwiU3VpemEiXV0sInNmIjpbWyJBbGVtYW5pYSIsIkNyb2FjaWEiXSxbIk3DqXhpY28iLCJBcmdlbnRpbmEiXV0sImZpbmFsIjpbIkFsZW1hbmlhIiwiTcOpeGljbyJdLCJjaGFtcGlvbiI6IkFsZW1hbmlhIiwidGhpcmRQbGFjZU1hdGNoIjpbIkNyb2FjaWEiLCJBcmdlbnRpbmEiXSwidGhpcmRQbGFjZVdpbm5lciI6IkNyb2FjaWEifQ==",
            "eyJ1c2VyIjoiQ2FybG9zIiwiYmV0IjoiTGxvcmVudGFkYSIsInNjb3JlciI6Ikt5bGlhbiBNYmFwcMOpIChGUkEpIiwiZ3JvdXBzIjp7IkEiOlsiTcOpeGljbyIsIkNvcmVhIGRlbCBTdXIiLCJDaGVxdWlhIl0sIkIiOlsiU3VpemEiLCJDYW5hZMOhIiwiQm9zbmlhIHkgSGVyLiJdLCJDIjpbIkJyYXNpbCIsIk1hcnJ1ZWNvcyIsIkVzY29jaWEiXSwiRCI6WyJFRVVVIiwiVHVycXXDrWEiLCJQYXJhZ3VheSJdLCJFIjpbIkFsZW1hbmlhIiwiRWN1YWRvciIsIkNvc3RhIGRlIE1hcmZpbCJdLCJGIjpbIlBhw61zZXMgQmFqb3MiLCJKYXDDs24iLCJTdWVjaWEiXSwiRyI6WyJCw6lsZ2ljYSIsIkVnaXB0byIsIklyw6FuIl0sIkgiOlsiRXNwYcOxYSIsIlVydWd1YXkiLCJBcmFiaWEgU2F1ZMOtIl0sIkkiOlsiRnJhbmNpYSIsIk5vcnVlZ2EiLCJTZW5lZ2FsIl0sIkoiOlsiQXJnZW50aW5hIiwiQXVzdHJpYSIsIkFyZ2VsaWEiXSwiSyI6WyJQb3J0dWdhbCIsIkNvbG9tYmlhIiwiUkQgQ29uZ28iXSwiTCI6WyJJbmdsYXRlcnJhIiwiQ3JvYWNpYSIsIkdoYW5hIl19LCJ0aGlyZHMiOlsiQ2hlcXVpYSIsIkJvc25pYSB5IEhlci4iLCJFc2NvY2lhIiwiUGFyYWd1YXkiLCJDb3N0YSBkZSBNYXJmaWwiLCJTdWVjaWEiLCJTZW5lZ2FsIiwiQXJnZWxpYSJdLCJyMTYiOltbIlBhcmFndWF5IiwiU3VlY2lhIl0sWyJDYW5hZMOhIiwiUGHDrXNlcyBCYWpvcyJdLFsiQ29sb21iaWEiLCJBdXN0cmlhIl0sWyJFRVVVIiwiQsOpbGdpY2EiXSxbIkphcMOzbiIsIk5vcnVlZ2EiXSxbIkVzY29jaWEiLCJTZW5lZ2FsIl0sWyJVcnVndWF5IiwiVHVycXXDrWEiXSxbIlN1aXphIiwiUG9ydHVnYWwiXV0sInFmIjpbWyJQYXJhZ3VheSIsIkNhbmFkw6EiXSxbIkF1c3RyaWEiLCJFRVVVIl0sWyJKYXDDs24iLCJTZW5lZ2FsIl0sWyJVcnVndWF5IiwiU3VpemEiXV0sInNmIjpbWyJQYXJhZ3VheSIsIkF1c3RyaWEiXSxbIlNlbmVnYWwiLCJTdWl6YSJdXSwiZmluYWwiOlsiUGFyYWd1YXkiLCJTdWl6YSJdLCJjaGFtcGlvbiI6IlBhcmFndWF5IiwidGhpcmRQbGFjZU1hdGNoIjpbIkF1c3RyaWEiLCJTZW5lZ2FsIl0sInRoaXJkUGxhY2VXaW5uZXIiOiJBdXN0cmlhIn0=",
            "eyJ1c2VyIjoiZGZzZGYiLCJiZXQiOiJmZHNmc2RmcyIsInNjb3JlciI6IlJvZHJ5Z28iLCJncm91cHMiOnsiQSI6WyJDaGVxdWlhIiwiQ29yZWEgZGVsIFN1ciIsIk3DqXhpY28iXSwiQiI6WyJDYXRhciIsIlN1aXphIiwiQ2FuYWTDoSJdLCJDIjpbIkJyYXNpbCIsIk1hcnJ1ZWNvcyIsIkVzY29jaWEiXSwiRCI6WyJQYXJhZ3VheSIsIlR1cnF1w61hIiwiRUVVVSJdLCJFIjpbIkNvc3RhIGRlIE1hcmZpbCIsIkN1cmHDp2FvIiwiQWxlbWFuaWEiXSwiRiI6WyJKYXDDs24iLCJQYcOtc2VzIEJham9zIiwiU3VlY2lhIl0sIkciOlsiTnVldmEgWmVsYW5kYSIsIkVnaXB0byIsIklyw6FuIl0sIkgiOlsiRXNwYcOxYSIsIlVydWd1YXkiLCJBcmFiaWEgU2F1ZMOtIl0sIkkiOlsiTm9ydWVnYSIsIklyYWsiLCJTZW5lZ2FsIl0sIkoiOlsiQXVzdHJpYSIsIkFyZ2VsaWEiLCJKb3JkYW5pYSJdLCJLIjpbIlBvcnR1Z2FsIiwiQ29sb21iaWEiLCJSRCBDb25nbyJdLCJMIjpbIkNyb2FjaWEiLCJHaGFuYSIsIkluZ2xhdGVycmEiXX0sInRoaXJkcyI6WyJNw6l4aWNvIiwiQ2FuYWTDoSIsIkVFVVUiLCJTdWVjaWEiLCJJcsOhbiIsIkFyYWJpYSBTYXVkw60iLCJTZW5lZ2FsIiwiUkQgQ29uZ28iXSwicjE2IjpbWyJDb3N0YSBkZSBNYXJmaWwiLCJOb3J1ZWdhIl0sWyJTdWl6YSIsIk1hcnJ1ZWNvcyJdLFsiQ29sb21iaWEiLCJFc3Bhw7FhIl0sWyJQYXJhZ3VheSIsIk51ZXZhIFplbGFuZGEiXSxbIkJyYXNpbCIsIkN1cmHDp2FvIl0sWyJBcmFiaWEgU2F1ZMOtIiwiUkQgQ29uZ28iXSxbIlVydWd1YXkiLCJFZ2lwdG8iXSxbIkNhdGFyIiwiUG9ydHVnYWwiXV0sInFmIjpbWyJDb3N0YSBkZSBNYXJmaWwiLCJNYXJydWVjb3MiXSxbIkNvbG9tYmlhIiwiTnVldmEgWmVsYW5kYSJdLFsiQnJhc2lsIiwiQXJhYmlhIFNhdWTDrSJdLFsiRWdpcHRvIiwiUG9ydHVnYWwiXV0sInNmIjpbWyJNYXJydWVjb3MiLCJOdWV2YSBaZWxhbmRhIl0sWyJCcmFzaWwiLCJFZ2lwdG8iXV0sImZpbmFsIjpbIk51ZXZhIFplbGFuZGEiLCJFZ2lwdG8iXSwiY2hhbXBpb24iOiJFZ2lwdG8iLCJ0aGlyZFBsYWNlTWF0Y2giOlsiTWFycnVlY29zIiwiQnJhc2lsIl0sInRoaXJkUGxhY2VXaW5uZXIiOiJNYXJydWVjb3MifQ=="
        };

        String[][] predictionInfo = {
            {"Anónimo", "Porra_1"},
            {"Carlos", "Llorentada"},
            {"dfsdf", "fdsfsdfs"}
        };

        Edition globalEdition = editionRepository.findByLeagueIdAndStatus(1L, "ACTIVE").orElse(null);
        if (globalEdition != null && globalEdition.getLockDate() == null) {
            globalEdition.setLockDate(LocalDateTime.of(2026, 6, 11, 20, 0));
            globalEdition = editionRepository.save(globalEdition);
        }

        for (int i = 0; i < hashes.length; i++) {
            final String pName = predictionInfo[i][0];

            UserAccount user = userAccountRepository.findByParticipantName(pName)
                .orElseGet(() -> userAccountRepository.save(UserAccount.builder()
                        .googleEmail(pName + "@local")
                        .googleName(pName)
                        .participantName(pName)
                        .build()));

            Prediction pred = Prediction.builder()
                    .user(user)
                    .edition(globalEdition)
                    .name(predictionInfo[i][1])
                    .paymentStatus("PAID")
                    .build();
            pred = predictionRepository.save(pred);

            try {
                String decoded = new String(Base64.getDecoder().decode(hashes[i]), StandardCharsets.UTF_8);
                ObjectMapper mapper = new ObjectMapper();
                PredictionDataDTO dto = mapper.readValue(decoded, PredictionDataDTO.class);
                predictionPersistenceService.saveRelationalPredictions(pred, dto);
            } catch (Exception e) {
                log.error("Failed to parse initial prediction data", e);
            }
        }

        log.info("Seeded {} existing predictions.", hashes.length);
    }
}
