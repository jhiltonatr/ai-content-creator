package com.example.company.core.analysis;

public record AnalysisFinding(int paragraph,
                              int from,
                              int to,
                              String severity,
                              String category,
                              String message,
                              String reason,
                              String suggestion) {}
