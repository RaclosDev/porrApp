package app.porrapp.service.league;

import app.porrapp.model.League;

/**
 * Quién tiene la cuota pendiente, con el mismo criterio en la clasificación, el resumen de Inicio y la
 * lista de predicciones: una liga sin cuota o pública no deja a nadie pendiente; si cobra, manda el pago
 * del miembro (lo que marca el administrador) y, si no es miembro, el de la predicción.
 */
public final class PaymentRule {

    public static final String PAID = "PAID";

    private PaymentRule() {
    }

    /** Si la liga cobra cuota de entrada. */
    public static boolean charges(League league) {
        return league != null && league.isEntryFee() && !league.isPublicLeague();
    }

    /**
     * @param membershipStatus estado de pago del miembro, o null si no es miembro de la liga
     * @param predictionPaid   pago guardado en la predicción, para quien no es miembro
     */
    public static boolean pending(League league, String membershipStatus, Boolean predictionPaid) {
        if (!charges(league)) return false;
        if (membershipStatus != null) return !PAID.equalsIgnoreCase(membershipStatus);
        return !Boolean.TRUE.equals(predictionPaid);
    }
}
