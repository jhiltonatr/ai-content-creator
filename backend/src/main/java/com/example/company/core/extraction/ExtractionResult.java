package com.example.company.core.extraction;

import java.util.List;

public record ExtractionResult(List<CharacterSuggestion> characters, List<LoreSuggestion> lore) {}