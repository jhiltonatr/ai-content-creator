package com.example.company.core.extraction;

import com.example.company.core.analysis.ProseAnalysisRequest;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public interface ExtractionClient {

    ExtractionResult extract(ProseAnalysisRequest request, List<String> types, AtomicBoolean abort);
}