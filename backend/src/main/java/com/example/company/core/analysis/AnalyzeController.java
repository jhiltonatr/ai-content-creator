package com.example.company.core.analysis;

import com.example.company.core.web.CurrentUserId;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;

@RestController
@RequestMapping("/api/stories/{storyId}/nodes/{nodeId}")
public class AnalyzeController {

    private static final long RETRY_BUDGET_MS = 6000;

    private final AnalyzeService analyze;
    private final AnalysisProperties props;
    private final ExecutorService executor;

    public AnalyzeController(
            AnalyzeService analyze,
            AnalysisProperties props,
            @Qualifier("analysisExecutor") ExecutorService executor) {
        this.analyze = analyze;
        this.props = props;
        this.executor = executor;
    }

    @PostMapping("/analyze")
    public DeferredResult<AnalyzeResponse> analyze(
            @CurrentUserId Long userId,
            @PathVariable long storyId,
            @PathVariable long nodeId,
            @RequestBody(required = false) AnalyzeRequest request) {
        AnalyzeService.PreparedAnalysis prepared = analyze.prepare(userId, storyId, nodeId, request);

        DeferredResult<AnalyzeResponse> result =
                new DeferredResult<>(props.timeoutMs() * 2L + RETRY_BUDGET_MS);
        AtomicBoolean abort = new AtomicBoolean();
        Future<?> task = executor.submit(() -> {
            try {
                result.setResult(analyze.run(prepared, abort));
            } catch (AnalysisAbortedException ignored) {
                // Client disconnected; there is nothing to deliver.
            } catch (Exception e) {
                result.setErrorResult(e);
            }
        });
        result.onTimeout(() -> abortAndCancel(abort, task));
        result.onError(ex -> abortAndCancel(abort, task));
        result.onCompletion(() -> abortAndCancel(abort, task));
        return result;
    }

    private static void abortAndCancel(AtomicBoolean abort, Future<?> task) {
        abort.set(true);
        task.cancel(true);
    }
}