package com.porra.mundial.service.league;

import com.porra.mundial.service.sync.CompetitionImportRequestedEvent;
import com.porra.mundial.exception.BusinessException;
import java.time.Instant;
import java.util.Map;
import com.porra.mundial.dto.LeagueResponseDTO;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.model.League;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Membership;
import com.porra.mundial.util.JoinCodeGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import java.util.stream.Collectors;


/** Ligas: creación, invitaciones, miembros, pagos y abandono. */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeagueService {

    private final LeagueRepository leagueRepository;
    private final PredictionRepository predictionRepository;
    private final UserAccountRepository userAccountRepository;
    private final CompetitionRepository competitionRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final ApplicationEventPublisher eventPublisher;

    /** Liga ya creada por este usuario con esa clave de idempotencia, si existe. */
    @Transactional(readOnly = true)
    public Optional<League> findCreatedWithKey(String email, String creationKey) {
        return userAccountRepository.findByGoogleEmail(email)
                .flatMap(user -> leagueRepository.findByAdminUserIdAndCreationKey(user.getId(), creationKey));
    }

    /** Crea una liga; quien la crea pasa a ser su administrador y su primer miembro. */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public League createLeague(NewLeague request) {
        String name = request.name();
        String email = request.adminEmail();
        Long competitionId = request.competitionId();
        com.porra.mundial.model.PoolFormat poolFormat = request.poolFormat();
        boolean pichichi = request.countsScorers();
        String customCompetitionName = request.customCompetitionName();
        String creationKey = request.creationKey();
        boolean custom = customCompetitionName != null && !customCompetitionName.isBlank();
        if (custom == (competitionId != null)) {
            throw BusinessException.badRequest("Elige una competición existente o indica una nueva");
        }
        if (poolFormat == null) {
            throw BusinessException.badRequest("Elige el formato de la porra");
        }
        if (custom && (customCompetitionName.trim().length() > 100 || poolFormat == null)) {
            throw BusinessException.badRequest("La competición personalizada requiere un formato y un nombre de hasta 100 caracteres");
        }
        if (custom && poolFormat == com.porra.mundial.model.PoolFormat.GRAND_PRIX) {
            throw BusinessException.badRequest("El modo Gran Premio necesita la Fórmula 1 oficial");
        }
        if (custom && poolFormat == com.porra.mundial.model.PoolFormat.SURVIVOR) {
            // Sin resultados automáticos nadie sabría cuándo queda eliminado cada uno.
            throw BusinessException.badRequest("El modo superviviente necesita una competición oficial");
        }
        UserAccount adminUser = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));

        // Repetición de la misma creación (doble clic o reintento): se devuelve la liga ya creada.
        if (creationKey != null) {
            Optional<League> existing = leagueRepository.findByAdminUserIdAndCreationKey(adminUser.getId(), creationKey);
            if (existing.isPresent()) {
                log.info("Creación de liga repetida por el usuario {}: se reutiliza la liga {}", adminUser.getId(), existing.get().getId());
                return existing.get();
            }
        }

        String joinCode;
        do {
            joinCode = JoinCodeGenerator.next();
        } while (leagueRepository.findByJoinCode(joinCode).isPresent());

        Competition comp = null;
        if (!custom) {
            comp = competitionRepository.findById(competitionId)
                    .orElseThrow(() -> BusinessException.notFound("Competición no encontrada"));
            if (comp.getOwnerLeague() != null) {
                throw BusinessException.forbidden("Esta competición pertenece a otra liga");
            }
            // Sin proveedor de datos la liga se quedaría sin equipos ni partidos.
            if (comp.getExternalId() == null || comp.getExternalId().isBlank()) {
                throw BusinessException.badRequest("Esta competición no se puede seguir: elige otra");
            }
            if (com.porra.mundial.model.Sport.isMma(comp) && poolFormat != com.porra.mundial.model.PoolFormat.MATCH_DAY) {
                throw BusinessException.badRequest("La UFC se juega velada a velada: elige Por veladas");
            }
            if (comp.isFormulaOne() != (poolFormat == com.porra.mundial.model.PoolFormat.GRAND_PRIX)) {
                throw BusinessException.badRequest(comp.isFormulaOne()
                        ? "La Fórmula 1 se juega Gran Premio a Gran Premio"
                        : "El modo Gran Premio es solo para la Fórmula 1");
            }
            // Los playoffs de la NBA se pronostican serie a serie; los partidos, en la temporada regular.
            if (comp.playsSeries() && poolFormat != com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY) {
                throw BusinessException.badRequest("De los playoffs de la NBA se pronostica serie a serie: elige el modo Playoffs."
                        + " Para predecir partidos, elige NBA · Temporada regular");
            }
            if (comp.drawsKnockoutRounds() && poolFormat == com.porra.mundial.model.PoolFormat.FULL_BRACKET) {
                throw BusinessException.badRequest("Los cruces de esta competición se sortean ronda a ronda: elige Solo eliminatorias");
            }
            // La temporada regular de la NBA no tiene cuadro: se juega partido a partido.
            if (com.porra.mundial.sports.EspnNbaDataProvider.isRegularSeason(comp.getExternalId())
                    && !com.porra.mundial.model.PoolFormat.isMatchBased(poolFormat)) {
                throw BusinessException.badRequest("La temporada regular de la NBA se juega partido a partido: elige Por semanas o Superviviente");
            }
            // Una liga regular (LaLiga, Premier, NFL…) no tiene cuadro: el asistente ya no lo ofrece.
            if ("LEAGUE".equalsIgnoreCase(comp.getFormatType()) && !comp.isWorldCup() && !comp.drawsKnockoutRounds()
                    && !poolFormat.isMatchBased() && poolFormat != com.porra.mundial.model.PoolFormat.GRAND_PRIX) {
                throw BusinessException.badRequest("Esta competición se juega por jornadas: no tiene cuadro que rellenar");
            }
            if (com.porra.mundial.model.Sport.isTennis(comp) && poolFormat != com.porra.mundial.model.PoolFormat.MATCH_DAY) {
                throw BusinessException.badRequest("Los torneos de tenis se juegan partido a partido");
            }
            // Con el cuadro ya empezado nadie podría enviar su predicción: la liga nacería muerta.
            java.time.Instant closes = com.porra.mundial.service.prediction.PredictableBracket.predictionsCloseAt(
                    comp, poolFormat, matchRepository.findByCompetitionId(comp.getId()));
            if (closes != null && !closes.isAfter(java.time.Instant.now())) {
                throw BusinessException.badRequest(poolFormat == com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY
                        ? "Las eliminatorias de esta competición ya han empezado: elige Por jornadas"
                        : "Esta competición ya ha empezado: el cuadro completo ya no admite predicciones");
            }
        }

        League group = League.builder()
                .name(name)
                .joinCode(joinCode)
                .adminUser(adminUser)
                .creationKey(creationKey)
                .build();
        group = leagueRepository.save(group);

        if (custom) {
            comp = competitionRepository.save(Competition.builder()
                    .name(customCompetitionName.trim())
                    .formatType(poolFormat == com.porra.mundial.model.PoolFormat.MATCH_DAY ? "LEAGUE" : "TOURNAMENT")
                    .ownerLeague(group)
                    .build());
        }

        Membership.MembershipId memId = new Membership.MembershipId(adminUser.getId(), group.getId());
        membershipRepository.save(Membership.builder()
                .id(memId)
                .user(adminUser)
                .league(group)
                .role("ADMIN")
                .build());

        java.time.Instant defaultLockDate = Edition.defaultLockDate(comp, poolFormat);
        editionRepository.save(Edition.builder()
                .league(group)
                .competition(comp)
                .poolFormat(poolFormat)
                .lockDate(defaultLockDate)
                // Unas eliminatorias sorteadas ronda a ronda no pueden cerrarse de una vez.
                // En la NBA cada serie se cierra al empezar su primer partido, y cada Gran Premio de Fórmula 1
                // al empezar su clasificación (la fecha de su fila de matches).
                // Un cuadro sin fecha de cierre conocida se cierra al empezar su primer partido, como propone
                // el asistente: en una fecha fija sin fecha no se cerraría nunca.
                .lockMode(comp.playsSeries() || poolFormat == com.porra.mundial.model.PoolFormat.GRAND_PRIX
                        ? com.porra.mundial.model.PredictionLockMode.PER_MATCH
                        : com.porra.mundial.model.PoolFormat.isMatchBased(poolFormat)
                        ? com.porra.mundial.model.PredictionLockMode.FIXED_DATE
                        : comp.drawsKnockoutRounds()
                        ? com.porra.mundial.model.PredictionLockMode.PER_ROUND
                        : defaultLockDate != null
                        ? com.porra.mundial.model.PredictionLockMode.FIXED_DATE
                        : com.porra.mundial.model.PredictionLockMode.FIRST_MATCH)
                // El único pichichi oficial es el del cuadro del Mundial.
                .pichichi(pichichi && Edition.isWorldCupBracket(comp, poolFormat))
                .status("ACTIVE")
                .scoringRulesJson((com.porra.mundial.model.Sport.isTennis(comp)
                        ? com.porra.mundial.scoring.ScoringRuleSet.defaultTennis()
                        : com.porra.mundial.scoring.ScoringRuleSet.defaults()).toJson())
                .build());

        if (comp.getExternalId() != null && !comp.getExternalId().isBlank()) {
            // Siempre la temporada entera, aunque ya haya partidos sueltos de la sincronización diaria.
            // Se importa tras confirmar la liga: si ESPN falla, la liga ya está creada.
            eventPublisher.publishEvent(new CompetitionImportRequestedEvent(comp.getId()));
        }

        return group;
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public League updateLeague(Long groupId, String newName, String newRules, Boolean entryFee, String email) {
        League group = LeagueAdmins.require(leagueRepository, groupId, email);

        boolean changed = false;

        if (newName != null) {
            if (newName.trim().isEmpty()) {
                throw BusinessException.badRequest("El nombre no puede estar vacío");
            }
            group.setName(newName.trim());
            changed = true;
        }

        if (newRules != null) {
            group.setRules(newRules.trim());
            changed = true;
        }

        if (entryFee != null) {
            if (entryFee && group.isPublicLeague()) {
                throw BusinessException.badRequest("Una liga pública no puede tener cuota");
            }
            group.setEntryFee(entryFee);
            changed = true;
        }

        if (!changed) {
            throw BusinessException.badRequest("No hay cambios que guardar");
        }

        return leagueRepository.save(group);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void deleteLeague(Long groupId, String email) {
        LeagueAdmins.require(leagueRepository, groupId, email);
        
        predictionRepository.deleteByLeagueId(groupId);
        
        List<Edition> editions = editionRepository.findByLeagueId(groupId);
        editionRepository.deleteAll(editions);
        editionRepository.flush();

        editions.stream().map(Edition::getCompetition).filter(c -> c.getOwnerLeague() != null
                && groupId.equals(c.getOwnerLeague().getId())).forEach(c -> {
            matchRepository.deleteAll(matchRepository.findByCompetitionId(c.getId()));
            matchRepository.flush();
            teamRepository.deleteAll(teamRepository.findByCompetitionIdOrderByNameAsc(c.getId()));
            teamRepository.flush();
            competitionRepository.delete(c);
        });

        competitionRepository.flush();
        
        membershipRepository.deleteByLeagueId(groupId);
        
        leagueRepository.deleteById(groupId);
    }

    // Solo se cachean los aciertos: un código inexistente no debe quedarse en memoria
    // (ni hacer crecer la caché con cada intento) ni ocultar una liga creada después.
    @org.springframework.cache.annotation.Cacheable(value = "groupByCode", key = "#joinCode", unless = "#result == null")
    public Optional<League> getLeagueByJoinCode(String joinCode) {
        return leagueRepository.findByJoinCode(joinCode);
    }

    /**
     * @param email Email del usuario
     * @return Las ligas donde está jugando.
     */
    @Transactional(readOnly = true)
    public List<League> getUserLeagues(String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return List.of();
        
        List<Membership> memberships = membershipRepository.findByUserId(user.getId());

        List<Long> groupIds = memberships.stream()
                .map(m -> m.getId().getLeagueId())
                .distinct()
                .collect(Collectors.toList());

        return leagueRepository.findAllById(groupIds);
    }

    /**
     * @return DTOs planos para pasarlos al JSON (API).
     */
    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "userGroups", key = "#email")
    public List<LeagueResponseDTO> getUserLeagueDTOs(String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return List.of();
        java.util.Map<Long, Instant> joinedAt = new java.util.HashMap<>();
        for (Membership m : membershipRepository.findByUserId(user.getId())) {
            joinedAt.merge(m.getId().getLeagueId(), m.getJoinedAt() != null ? m.getJoinedAt() : Instant.EPOCH,
                    (a, b) -> a.isBefore(b) ? a : b);
        }
        List<League> groups = leagueRepository.findAllById(joinedAt.keySet());
        if (groups.isEmpty()) return List.of();

        List<Long> groupIds = groups.stream().map(League::getId).collect(Collectors.toList());
        List<Edition> activeEditions = editionRepository.findByLeagueIdInAndStatus(groupIds, "ACTIVE");
        
        java.util.Map<Long, Edition> editionMap = activeEditions.stream()
                .collect(Collectors.toMap(e -> e.getLeague().getId(), e -> e, (e1, e2) -> e1));

        return groups.stream()
                .map(g -> {
                    LeagueResponseDTO dto = LeagueResponseDTO.of(g, editionMap.get(g.getId()), true);
                    Instant joined = joinedAt.get(g.getId());
                    dto.setJoinedAt(Instant.EPOCH.equals(joined) ? null : joined);
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /** Edición activa (la que se está jugando) de una liga. */
    @Transactional(readOnly = true)
    public Optional<Edition> findActiveEdition(Long leagueId) {
        return editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE");
    }

    /** Liga con su edición activa; el código de invitación solo se incluye si se indica. */
    @Transactional(readOnly = true)
    public LeagueResponseDTO toResponse(League league, boolean includeJoinCode) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElse(null);
        LeagueResponseDTO dto = LeagueResponseDTO.of(league, edition, includeJoinCode);
        if (edition != null && edition.isMultiCompetition() && edition.getCompetition() != null
                && edition.getId() != null) {
            dto.setCompetitions(competitionsOf(edition));
        }
        return dto;
    }

    /** Las competiciones de una liga que junta varias: la principal primero y las demás por id. */
    private List<LeagueResponseDTO.CompetitionRef> competitionsOf(Edition edition) {
        Competition primary = edition.getCompetition();
        List<LeagueResponseDTO.CompetitionRef> refs = new ArrayList<>();
        refs.add(LeagueResponseDTO.CompetitionRef.of(primary));
        competitionRepository.findByEditionId(edition.getId()).stream()
                .filter(c -> !java.util.Objects.equals(c.getId(), primary.getId()))
                .sorted(java.util.Comparator.comparing(Competition::getId))
                .map(LeagueResponseDTO.CompetitionRef::of)
                .forEach(refs::add);
        return refs;
    }

    /**
     * Detalle de una liga. Quien no es miembro de una liga privada solo ve lo mismo que en la
     * vista previa de una invitación; solo los miembros ven el código de invitación.
     */
    @Transactional(readOnly = true)
    public Optional<LeagueResponseDTO> findLeagueResponse(Long id, String viewerEmail) {
        // Una liga privada no existe para quien no es miembro: así no se pueden recorrer por id.
        // Para unirse, la vista previa va por código de invitación (findInvitationPreview).
        return getLeagueById(id).flatMap(league -> {
            boolean member = isUserMemberOrAdmin(id, viewerEmail);
            return member || league.isPublicLeague() ? Optional.of(toResponse(league, member)) : Optional.empty();
        });
    }

    /** La liga pública más antigua, que la portada y la demo enseñan. */
    @Transactional(readOnly = true)
    public Optional<LeagueResponseDTO> findFeaturedLeagueResponse(String viewerEmail) {
        return leagueRepository.findFirstByPublicLeagueTrueOrderByIdAsc()
                .map(league -> toResponse(league, isUserMemberOrAdmin(league.getId(), viewerEmail)));
    }

    /** Datos públicos para previsualizar una invitación sin unirse a la liga. */
    @Transactional(readOnly = true)
    public Optional<LeagueResponseDTO> findInvitationPreview(String joinCode) {
        return getLeagueByJoinCode(joinCode).map(league -> LeagueResponseDTO.preview(
                league, editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElse(null)));
    }

    @org.springframework.cache.annotation.Cacheable(value = "groupById", key = "#id")
    public Optional<League> getLeagueById(Long id) {
        return leagueRepository.findById(id);
    }

    /**
     * Comprueba que el usuario puede ver los datos de una liga: las públicas, cualquiera;
     * el resto, solo sus miembros.
     *
     * @throws BusinessException si la liga es privada y el usuario no pertenece a ella
     */
    @Transactional(readOnly = true)
    public void assertCanView(Long groupId, String email) {
        if (groupId == null) {
            throw BusinessException.badRequest("Falta la liga");
        }
        if (leagueRepository.findById(groupId).map(League::isPublicLeague).orElse(false)) return;
        if (!isUserMemberOrAdmin(groupId, email)) {
            throw BusinessException.forbidden("No perteneces a esta liga privada");
        }
    }

    @Transactional(readOnly = true)
    public boolean isUserMemberOrAdmin(Long groupId, String email) {
        if (groupId == null || email == null || email.isBlank()) {
            return false;
        }
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) {
            return false;
        }
        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
        return membershipRepository.existsById(memId);
    }

    /**
     * Regenera el código de invitación de la liga si se ha filtrado.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public String regenerateJoinCode(Long groupId, String email) {
        League group = LeagueAdmins.require(leagueRepository, groupId, email);

        String newCode;
        do {
            newCode = JoinCodeGenerator.next();
        } while (leagueRepository.findByJoinCode(newCode).isPresent());
        group.setJoinCode(newCode);
        leagueRepository.save(group);
        return newCode;
    }
}
