package app.porrapp.dto;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import lombok.Builder;
import lombok.Data;

import tools.jackson.databind.annotation.JsonSerialize;

import java.time.Instant;
import java.util.List;

/**
 * DTO para la respuesta de un Grupo.
 * Contiene la información pública/básica de un grupo, junto con
 * detalles de la edición activa para que el Frontend sepa qué reglas aplicar.
 */
@Data
@Builder
public class LeagueResponseDTO {
    private Long id;
    private String name;
    private String joinCode;
    /** Nombre del participante que es administrador de este grupo. */
    private String adminParticipantName;
    private Long adminUserId;
    private Instant createdAt;
    /** Cuándo se unió el usuario (solo en sus ligas): elige su liga más reciente si sale de la activa. */
    private Instant joinedAt;
    
    /** Identificador de la competición asociada a la edición activa. */
    private Long competitionId;
    private Boolean customCompetition;
    /** Identificador de la competición en el proveedor de datos (fifa.world, lol.worlds…). */
    private String competitionExternalId;
    /** Nombre de la competición actual en curso (Ej: Euro 2024, LaLiga). */
    private String competitionName;
    /** Formato de competición física: "LEAGUE" o "TOURNAMENT". */
    private String formatType;
    /** Eliminatorias que se sortean ronda a ronda (Champions, Copa del Rey…): se pronostica ronda a ronda. */
    private boolean knockoutDraw;
    /** Torneo con fase de grupos que se predice entero antes de empezar (grupos, terceros y cuadro). */
    private boolean groupTournament;
    /** Rondas eliminatorias de ese torneo con grupos, para nombrarlas; null si la competición no lo es. */
    private TournamentRoundsDTO tournamentRounds;
    /** Formato de porra / modalidad (FULL_BRACKET, KNOCKOUTS_ONLY, MATCH_DAY). */
    private String poolFormat;
    /** Si esta edición cuenta con un premio/ranking al pichichi. */
    private Boolean pichichi;
    /** Fecha y hora límite para enviar pronósticos en esta edición. */
    @JsonSerialize(using = MadridDateTimeSerializer.class)
    private Instant lockDate;
    /** Cómo se cierran los pronósticos (FIXED_DATE, FIRST_MATCH, PER_ROUND, PER_MATCH). */
    private String lockMode;
    /** Minutos antes del partido en que se cierra, en los modos que dependen de los partidos. */
    private Integer lockOffsetMinutes;
    /** Qué partidos entran en una liga por jornadas: ALL o CUSTOM (elegidos por el administrador). */
    private String matchSelection;
    /** La liga junta partidos de varias competiciones oficiales (la de {@link #competitionId} es la principal). */
    private boolean multiCompetition;
    /** En una liga de varias competiciones, cada una (la principal primero) para ver su tabla; null en las demás. */
    private List<CompetitionRef> competitions;
    /** Tenis de varios torneos: ALL, GRAND_SLAMS o MASTERS_1000; null en una liga de un solo torneo. */
    private String tennisScope;
    /** Tenis de varios torneos: ATP, WTA o BOTH. */
    private String tennisTour;
    /** Si la edición se encuentra cerrada para nuevos pronósticos o cambios. */
    private Boolean isLocked;
    /** Reglas personalizadas de la liga. */
    private String rules;
    /** URL (versionada) de la imagen de la liga, o null si no tiene. */
    private String imageUrl;
    /** Liga pública: se puede consultar sin ser miembro. */
    private boolean publicLeague;
    /** Liga con cuota de inscripción. */
    private boolean entryFee;
    /** Temporada de la competición que juega la liga ("2025/26", "2026"); null si no se sabe. */
    private String season;
    /** Esa temporada ya ha terminado: la liga se queda con su clasificación final. */
    private boolean seasonEnded;
    /** La liga ha terminado, la competición ya tiene temporada nueva y nadie la ha repetido aún. */
    private boolean canRepeat;
    /** Temporada nueva para la que se puede repetir la liga. */
    private String nextSeason;
    /** La liga que repite a esta en la temporada nueva; solo para quien también es miembro de ella. */
    private Long nextLeagueId;

    /**
     * Vista completa de una liga con los datos de su edición activa.
     *
     * @param edition         edición activa, o null si la liga no tiene
     * @param includeJoinCode solo los miembros ven el código de invitación
     */
    public static LeagueResponseDTO of(League league, Edition edition, boolean includeJoinCode) {
        LeagueResponseDTOBuilder builder = builder()
                .id(league.getId())
                .name(league.getName())
                .joinCode(includeJoinCode ? league.getJoinCode() : null)
                .adminParticipantName(league.getAdminParticipantName())
                .adminUserId(league.getAdminUserId())
                .createdAt(league.getCreatedAt())
                .rules(league.getRules())
                .imageUrl(league.getImageUrl())
                .publicLeague(league.isPublicLeague())
                .entryFee(league.isEntryFee())
                .isLocked(edition != null && edition.isLocked());
        if (edition != null) {
            withEdition(builder, edition)
                    .lockDate(edition.getLockDate());
        }
        return builder.build();
    }

    /** Vista pública para la previsualización de una invitación: sin administrador, reglas ni código. */
    public static LeagueResponseDTO preview(League league, Edition edition) {
        LeagueResponseDTOBuilder builder = builder()
                .id(league.getId())
                .name(league.getName())
                .imageUrl(league.getImageUrl())
                .publicLeague(league.isPublicLeague());
        if (edition != null) {
            withEdition(builder, edition);
        }
        return builder.build();
    }

    /**
     * Formato de la competición tal como la juega la liga: unas eliminatorias de la Champions se juegan
     * como torneo aunque la competición sea de liga (su fase de liga va por jornadas).
     */
    private static String playedFormatType(Competition competition, Edition edition) {
        if (competition == null) return null;
        if (competition.hasOwnBracket() && !app.porrapp.model.PoolFormat.isMatchBased(edition.getPoolFormat())) {
            return "TOURNAMENT";
        }
        return competition.getFormatType();
    }

    /** Una de las competiciones de una liga que junta varias. */
    public record CompetitionRef(Long id, String name, String externalId) {
        public static CompetitionRef of(Competition competition) {
            return new CompetitionRef(competition.getId(), competition.getName(), competition.getExternalId());
        }
    }

    private static LeagueResponseDTOBuilder withEdition(LeagueResponseDTOBuilder builder, Edition edition) {
        Competition competition = edition.getCompetition();
        return builder
                .competitionId(competition != null ? competition.getId() : null)
                .customCompetition(competition != null && competition.getOwnerLeague() != null)
                .competitionExternalId(competition != null ? competition.getExternalId() : null)
                .competitionName(competition != null ? competition.getName() : null)
                .formatType(playedFormatType(competition, edition))
                .groupTournament(competition != null && competition.isGroupTournament())
                .tournamentRounds(TournamentRoundsDTO.of(competition))
                .knockoutDraw(competition != null && competition.drawsKnockoutRounds()
                        && !app.porrapp.model.PoolFormat.isMatchBased(edition.getPoolFormat()))
                .poolFormat(edition.getPoolFormat() != null ? edition.getPoolFormat().name() : null)
                .lockMode(edition.getLockMode() != null ? edition.getLockMode().name() : null)
                .lockOffsetMinutes(edition.getLockOffsetMinutes())
                .matchSelection(edition.getMatchSelection() != null ? edition.getMatchSelection().name() : null)
                .multiCompetition(edition.isMultiCompetition())
                .tennisScope(edition.getTennisScope() != null ? edition.getTennisScope().name() : null)
                .tennisTour(edition.getTennisTour() != null ? edition.getTennisTour().name() : null)
                .pichichi(edition.scoresPichichi());
    }
}
