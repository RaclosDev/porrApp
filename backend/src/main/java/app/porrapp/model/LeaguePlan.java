package app.porrapp.model;

/** Plan de una liga. De momento solo cambia cuántos jugadores caben en un torneo de póker. */
public enum LeaguePlan {
    FREE("Gratis", 10),
    LIGA("Liga", 20),
    CLUB("Club", 50),
    CUSTOM("A medida", 100);

    private final String label;
    private final int maxPokerEntries;

    LeaguePlan(String label, int maxPokerEntries) {
        this.label = label;
        this.maxPokerEntries = maxPokerEntries;
    }

    public String label() {
        return label;
    }

    public int maxPokerEntries() {
        return maxPokerEntries;
    }
}
