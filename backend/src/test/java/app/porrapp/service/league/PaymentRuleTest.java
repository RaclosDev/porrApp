package app.porrapp.service.league;

import app.porrapp.model.League;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentRuleTest {

    private final League paid = League.builder().entryFee(true).build();

    @Test
    @DisplayName("Una liga sin cuota o pública no deja a nadie pendiente")
    void freeOrPublicLeaguesLeaveNobodyPending() {
        assertFalse(PaymentRule.pending(League.builder().build(), "PENDING", false));
        assertFalse(PaymentRule.pending(League.builder().entryFee(true).publicLeague(true).build(), "PENDING", false));
        assertFalse(PaymentRule.pending(null, null, null));
    }

    @Test
    @DisplayName("En una liga con cuota manda el pago del miembro, aunque la predicción diga otra cosa")
    void theMembershipPaymentWins() {
        assertFalse(PaymentRule.pending(paid, "PAID", false));
        assertFalse(PaymentRule.pending(paid, "paid", null));
        assertTrue(PaymentRule.pending(paid, "PENDING", true));
    }

    @Test
    @DisplayName("Quien no es miembro depende del pago guardado en su predicción")
    void nonMembersDependOnThePredictionPayment() {
        assertFalse(PaymentRule.pending(paid, null, true));
        assertTrue(PaymentRule.pending(paid, null, false));
        assertTrue(PaymentRule.pending(paid, null, null));
    }
}
