package com.example.company.core.analysis;

import java.util.List;

public record ProseAnalysisRequest(
        long storyId,
        long nodeId,
        String storyType,
        String language,
        List<String> characters,
        List<String> lore,
        List<String> paragraphs) {}
