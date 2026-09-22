package com.example.company.core.analysis;

import java.util.List;

public interface AnalysisClient {

    List<AnalysisFinding> analyze(ProseAnalysisRequest request);
}
