package com.porra.mundial.model;

import java.util.List;

/** FIFA 2026 draw procedures, Appendix A: bracket order, rather than kickoff order. */
public final class WorldCupBracketTopology {
    private WorldCupBracketTopology() {}

    public static final List<List<String>> ROUND_OF_32 = List.of(
            List.of("1E", "3ABCDF"), List.of("1I", "3CDFGH"),
            List.of("2A", "2B"), List.of("1F", "2C"),
            List.of("2K", "2L"), List.of("1H", "2J"),
            List.of("1D", "3BEFIJ"), List.of("1G", "3AEHIJ"),
            List.of("1C", "2F"), List.of("2E", "2I"),
            List.of("1A", "3CEFHI"), List.of("1L", "3EHIJK"),
            List.of("1J", "2H"), List.of("2D", "2G"),
            List.of("1B", "3EFGIJ"), List.of("1K", "3DEIJL"));
}
