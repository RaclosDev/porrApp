package com.porra.mundial.model;

/**
 * Estados deportivos canónicos y normalizados para partidos de cualquier competición.
 */
public enum MatchStatusNormalized {
    SCHEDULED,
    LIVE,
    PAUSED,
    FINISHED,
    POSTPONED,
    CANCELLED,
    ABANDONED,
    SUSPENDED;

    public boolean isFinished() {
        return this == FINISHED || this == ABANDONED;
    }

    public boolean isLive() {
        return this == LIVE || this == PAUSED;
    }

    public boolean isOpenForPrediction() {
        return this == SCHEDULED || this == POSTPONED;
    }

    public static MatchStatusNormalized fromString(String val) {
        if (val == null || val.isBlank()) {
            return SCHEDULED;
        }
        try {
            return MatchStatusNormalized.valueOf(val.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            return SCHEDULED;
        }
    }

    public static MatchStatusNormalized fromExternal(String state, boolean completed) {
        if (completed) {
            return FINISHED;
        }
        if ("in".equalsIgnoreCase(state) || "live".equalsIgnoreCase(state)) {
            return LIVE;
        }
        if ("postponed".equalsIgnoreCase(state) || "post".equalsIgnoreCase(state)) {
            return POSTPONED;
        }
        if ("canceled".equalsIgnoreCase(state) || "cancelled".equalsIgnoreCase(state)) {
            return CANCELLED;
        }
        if ("suspended".equalsIgnoreCase(state)) {
            return SUSPENDED;
        }
        return SCHEDULED;
    }
}
