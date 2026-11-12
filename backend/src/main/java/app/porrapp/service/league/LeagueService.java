package app.porrapp.service.league;

import app.porrapp.service.sync.CompetitionImportRequestedEvent;
import app.porrapp.exception.BusinessException;
import java.time.Instant;
import java.util.Map;
import app.porrapp.dto.LeagueResponseDTO;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.model.League;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.model.UserAccount;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.Membership;
import app.porrapp.util.JoinCodeGenerator;
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
    private final LeagueSeasons leagueSeasons;

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
        app.porrapp.model.PoolFormat poolFormat = request.poolFormat();
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
        if (custom && poolFormat == app.porrapp.model.PoolFormat.GRAND_PRIX) {
            throw BusinessException.badRequest("El modo Gran Premio necesita la Fórmula 1 oficial");
        }
        if (custom && poolFormat == app.porrapp.model.PoolFormat.SURVIVOR) {
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
            if (comp.isArchived()) {
                throw BusinessException.badRequest("Esa temporada ya ha terminado: vuelve a elegir la competición");
            }
            // Sin proveedor de datos la liga se quedaría sin equipos ni partidos.
            if (comp.getExternalId() == null || comp.getExternalId().isBlank()) {
                throw BusinessException.badRequest("Esta competición no se puede seguir: elige otra");
            }
            if (app.porrapp.model.Sport.isMma(comp) && poolFormat != app.porrapp.model.PoolFormat.MATCH_DAY) {
                throw BusinessException.badRequest("La UFC se juega velada a velada: elige Por veladas");
            }
            if (comp.isFormulaOne() != (poolFormat == app.porrapp.model.PoolFormat.GRAND_PRIX)) {
                throw BusinessException.badRequest(comp.isFormulaOne()
                        ? "La Fórmula 1 se juega Gran Premio a Gran Premio"
                        : "El modo Gran Premio es solo para la Fórmula 1");
            }
            // Los playoffs de la NBA se pronostican serie a serie; los partidos, en la temporada regular.
            if (comp.playsSeries() && poolFormat != app.porrapp.model.PoolFormat.KNOCKOUTS_ONLY) {
                throw BusinessException.badRequest("De los playoffs de la NBA se pronostica serie a serie: elige el modo Playoffs."
                        + " Para predecir partidos, elige NBA · Temporada regular");
            }
            if (comp.drawsKnockoutRounds() && poolFormat == app.porrapp.model.PoolFormat.FULL_BRACKET) {
                throw BusinessException.badRequest("Los cruces de esta competición se sortean ronda a ronda: elige Solo eliminatorias");
            }
            // La temporada regular de la NBA no tiene cuadro: se juega partido a partido.
            if (app.porrapp.sports.EspnNbaDataProvider.isRegularSeason(comp.getExternalId())
                    && !app.porrapp.model.PoolFormat.isMatchBased(poolFormat)) {
                throw BusinessException.badRequest("La temporada regular de la NBA se juega partido a partido: elige Por semanas o Superviviente");
            }
            // Una liga regular (LaLiga, Premier, NFL…) no tiene cuadro: el asistente ya no lo ofrece.
            if ("LEAGUE".equalsIgnoreCase(comp.getFormatType()) && !comp.isGroupTournament() && !comp.drawsKnockoutRounds()
                    && !poolFormat.isMatchBased() && poolFormat != app.porrapp.model.PoolFormat.GRAND_PRIX) {
                throw BusinessException.badRequest("Esta competición se juega por jornadas: no tiene cuadro que rellenar");
            }
            if (app.porrapp.model.Sport.isTennis(comp) && poolFormat != app.porrapp.model.PoolFormat.MATCH_DAY) {
                throw BusinessException.badRequest("Los torneos de tenis se juegan partido a partido");
            }
            // Con el cuadro ya empezado nadie podría enviar su predicción: la liga nacería muerta.
            java.time.Instant closes = app.porrapp.service.prediction.PredictableBracket.predictionsCloseAt(
                    comp, poolFormat, matchRepository.findByCompetitionId(comp.getId()));
            if (closes != null && !closes.isAfter(java.time.Instant.now())) {
                throw BusinessException.badRequest(poolFormat == app.porrapp.model.PoolFormat.KNOCKOUTS_ONLY
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
                    .formatType(poolFormat == app.porrapp.model.PoolFormat.MATCH_DAY ? "LEAGUE" : "TOURNAMENT")
                    .ownerLeague(group)
                    .sport(request.customSport())
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
                .lockMode(comp.playsSeries() || poolFormat == app.porrapp.model.PoolFormat.GRAND_PRIX
                        ? app.porrapp.model.PredictionLockMode.PER_MATCH
                        : app.porrapp.model.PoolFormat.isMatchBased(poolFormat)
                        ? app.porrapp.model.PredictionLockMode.FIXED_DATE
                        : comp.drawsKnockoutRounds()
                        ? app.porrapp.model.PredictionLockMode.PER_ROUND
                        : defaultLockDate != null
                        ? app.porrapp.model.PredictionLockMode.FIXED_DATE
                        : app.porrapp.model.PredictionLockMode.FIRST_MATCH)
                // Si no se dice nada, pichichi solo en el cuadro de un torneo con grupos, como siempre; pedido
                // expresamente, en cualquier competición de fútbol que lo admita.
                .pichichi(pichichi && (request.pichichi() == null
                        ? Edition.isGroupTournamentBracket(comp, poolFormat)
                        : Edition.allowsPichichi(comp, poolFormat, false)))
                .status("ACTIVE")
                .scoringRulesJson((app.porrapp.model.Sport.isTennis(comp)
                        ? app.porrapp.scoring.ScoringRuleSet.defaultTennis()
                        : app.porrapp.scoring.ScoringRuleSet.defaults()).toJson())
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

        return withAdminLoaded(leagueRepository.save(group));
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void deleteLeague(Long groupId, String email) {
        League group = LeagueAdmins.require(leagueRepository, groupId, email);
        if (!group.isCreator(email)) {
            throw BusinessException.forbidden("Solo el creador puede borrar la liga.");
        }
        
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
    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "groupByCode", key = "#joinCode", unless = "#result == null")
    public Optional<League> getLeagueByJoinCode(String joinCode) {
        return leagueRepository.findByJoinCode(joinCode).map(LeagueService::withAdminLoaded);
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
        List<League> groups = leagueRepository.findAllForUserDashboard(user.getId());
        if (groups.isEmpty()) return List.of();

        List<Long> groupIds = groups.stream().map(League::getId).collect(Collectors.toList());
        List<Edition> activeEditions = editionRepository.findByLeagueIdInAndStatus(groupIds, "ACTIVE");
        
        java.util.Map<Long, Edition> editionMap = activeEditions.stream()
                .collect(Collectors.toMap(e -> e.getLeague().getId(), e -> e, (e1, e2) -> e1));

        return groups.stream()
                .map(g -> {
                    Edition edition = editionMap.get(g.getId());
                    LeagueResponseDTO dto = withSeason(LeagueResponseDTO.of(g, edition, true), g, edition,
                            joinedAt::containsKey);
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
        return toResponse(league, includeJoinCode, null);
    }

    /**
     * Liga con su edición activa, tal como la ve {@code viewerEmail}: la liga que la repite en la temporada
     * nueva solo se le nombra si también es miembro de ella.
     */
    @Transactional(readOnly = true)
    public LeagueResponseDTO toResponse(League league, boolean includeJoinCode, String viewerEmail) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElse(null);
        LeagueResponseDTO dto = withSeason(LeagueResponseDTO.of(league, edition, includeJoinCode), league, edition,
                nextId -> isUserMemberOrAdmin(nextId, viewerEmail));
        if (edition != null && edition.isMultiCompetition() && edition.getCompetition() != null
                && edition.getId() != null) {
            dto.setCompetitions(competitionsOf(edition));
        }
        return dto;
    }

    /** Añade la temporada de la liga: si ha terminado, si se puede repetir y la liga que ya la repite. */
    private LeagueResponseDTO withSeason(LeagueResponseDTO dto, League league, Edition edition,
                                         java.util.function.Predicate<Long> viewerBelongsTo) {
        LeagueSeasons.Status status = leagueSeasons.status(league, edition, viewerBelongsTo);
        dto.setSeason(status.season());
        dto.setSeasonEnded(status.ended());
        dto.setCanRepeat(status.canRepeat());
        dto.setNextSeason(status.nextSeason());
        dto.setNextLeagueId(status.nextLeagueId());
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
            return member || league.isPublicLeague()
                    ? Optional.of(toResponse(league, member, viewerEmail)) : Optional.empty();
        });
    }

    /** La liga pública más antigua, que la portada y la demo enseñan. */
    @Transactional(readOnly = true)
    public Optional<LeagueResponseDTO> findFeaturedLeagueResponse(String viewerEmail) {
        return leagueRepository.findFirstByPublicLeagueTrueOrderByIdAsc()
                .map(league -> toResponse(league, isUserMemberOrAdmin(league.getId(), viewerEmail), viewerEmail));
    }

    /** Datos públicos para previsualizar una invitación sin unirse a la liga. */
    @Transactional(readOnly = true)
    public Optional<LeagueResponseDTO> findInvitationPreview(String joinCode) {
        return getLeagueByJoinCode(joinCode).map(league -> LeagueResponseDTO.preview(
                league, editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElse(null)));
    }

    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "groupById", key = "#id")
    public Optional<League> getLeagueById(Long id) {
        return leagueRepository.findWithPermissionsById(id).map(LeagueService::withAdminLoaded);
    }

    /**
     * La liga con su administrador cargado. Estas ligas se guardan en caché y se leen después sin sesión:
     * si la transacción ya tenía la liga sin él (cargada desde su edición), aquí se termina de cargar.
     */
    private static League withAdminLoaded(League league) {
        org.hibernate.Hibernate.initialize(league.getAdminUser());
        org.hibernate.Hibernate.initialize(league.getPrivilegedMemberships());
        return league;
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
