package com.porra.mundial.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/** Guarda las partes de la cartelera de una liga como «PRELIMS,MAIN»; null son todas. */
@Converter
public class CardSegmentsConverter implements AttributeConverter<Set<CardSegment>, String> {

    @Override
    public String convertToDatabaseColumn(Set<CardSegment> segments) {
        Set<CardSegment> normalized = CardSegment.normalized(segments);
        if (normalized == null) return null;
        return normalized.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    @Override
    public Set<CardSegment> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) return null;
        EnumSet<CardSegment> segments = EnumSet.noneOf(CardSegment.class);
        Arrays.stream(value.split(",")).map(CardSegment::of).filter(java.util.Objects::nonNull).forEach(segments::add);
        return CardSegment.normalized(segments);
    }
}
