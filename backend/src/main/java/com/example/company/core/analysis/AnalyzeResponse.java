package com.example.company.core.analysis;

import java.time.Instant;
import java.util.List;

public record AnalyzeResponse(
        long nodeId,
        long storyId,
        String model,
        Instant analyzedAt,
        List<String> paragraphs,
        List<AnalysisFinding> findings) {}
