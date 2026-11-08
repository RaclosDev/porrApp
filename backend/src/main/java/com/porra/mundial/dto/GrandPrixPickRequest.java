package com.porra.mundial.dto;

/** Predicción de un Gran Premio: podio y pole obligatorios, vuelta rápida opcional. */
public record GrandPrixPickRequest(Long first, Long second, Long third, Long pole, Long fastestLap) {}
