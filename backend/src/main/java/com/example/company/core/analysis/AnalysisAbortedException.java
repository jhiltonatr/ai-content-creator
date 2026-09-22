package com.example.company.core.analysis;

public class AnalysisAbortedException extends RuntimeException {

    public AnalysisAbortedException() {
        super("Analysis aborted; client disconnected");
    }
}