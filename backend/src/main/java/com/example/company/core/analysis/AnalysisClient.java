package com.example.company.core.analysis;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public interface AnalysisClient {

    List<AnalysisFinding> analyze(ProseAnalysisRequest request);

    default List<AnalysisFinding> analyze(ProseAnalysisRequest request, AtomicBoolean abort) {
        return analyze(request);
    }
}