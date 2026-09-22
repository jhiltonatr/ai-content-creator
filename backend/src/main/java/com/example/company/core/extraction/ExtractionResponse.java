package com.example.company.core.extraction;

import java.time.Instant;
import java.util.List;

public record ExtractionResponse(
        long nodeId,
        long storyId,
        String model,
        boolean enabled,
        Instant extractedAt,
        List<CharacterSuggestion> characters,
        List<LoreSuggestion> lore) {}