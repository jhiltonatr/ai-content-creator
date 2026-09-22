package com.example.company.core.analysis;

import com.example.company.core.web.CurrentUserId;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stories/{storyId}/nodes/{nodeId}")
public class AnalyzeController {

    private final AnalyzeService analyze;

    public AnalyzeController(AnalyzeService analyze) {
        this.analyze = analyze;
    }

    @PostMapping("/analyze")
    public AnalyzeResponse analyze(
            @CurrentUserId Long userId,
            @PathVariable long storyId,
            @PathVariable long nodeId,
            @RequestBody(required = false) AnalyzeRequest request) {
        return analyze.analyze(userId, storyId, nodeId, request);
    }
}