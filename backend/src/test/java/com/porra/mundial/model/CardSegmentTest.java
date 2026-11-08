package com.porra.mundial.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CardSegmentTest {

    private final CardSegmentsConverter converter = new CardSegmentsConverter();

    @Test
    @DisplayName("Todas las partes, o ninguna, son la velada completa y no se guardan")
    void normalized() {
        assertThat(CardSegment.normalized(null)).isNull();
        assertThat(CardSegment.normalized(List.of())).isNull();
        assertThat(CardSegment.normalized(List.of(CardSegment.values()))).isNull();
        assertThat(CardSegment.normalized(List.of(CardSegment.MAIN, CardSegment.MAIN)))
                .containsExactly(CardSegment.MAIN);
    }

    @Test
    @DisplayName("Una pelea entra si su parte está elegida o si no se sabe de qué parte es")
    void includes() {
        Set<CardSegment> main = EnumSet.of(CardSegment.MAIN);
        assertThat(CardSegment.includes(main, Fight.MAIN_CARD)).isTrue();
        assertThat(CardSegment.includes(main, Fight.PRELIMS)).isFalse();
        assertThat(CardSegment.includes(main, Fight.EARLY_PRELIMS)).isFalse();
        assertThat(CardSegment.includes(main, null)).isTrue();
        assertThat(CardSegment.includes(null, Fight.PRELIMS)).isTrue();
    }

    @Test
    @DisplayName("Se guardan en el orden de la velada y se leen igual")
    void converter() {
        String column = converter.convertToDatabaseColumn(EnumSet.of(CardSegment.MAIN, CardSegment.EARLY_PRELIMS));
        assertThat(column).isEqualTo("EARLY_PRELIMS,MAIN");
        assertThat(converter.convertToEntityAttribute(column))
                .containsExactly(CardSegment.EARLY_PRELIMS, CardSegment.MAIN);
        assertThat(converter.convertToDatabaseColumn(EnumSet.allOf(CardSegment.class))).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }
}
