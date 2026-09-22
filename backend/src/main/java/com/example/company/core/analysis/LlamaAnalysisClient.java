package com.example.company.core.analysis;

import com.example.company.core.common.ServiceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class LlamaAnalysisClient implements AnalysisClient {

    private static final Logger log = LoggerFactory.getLogger(LlamaAnalysisClient.class);
    private static final List<String> SEVERITIES = List.of("info", "warn", "danger");
    private static final String BLOCK_SEPARATOR = "====";
    private static final long RETRY_SLEEP_MS = 3000;
    private static final long ABORT_POLL_MS = 50;

    private final AnalysisProperties props;
    private final JsonMapper mapper;
    private final HttpClient http;

    public LlamaAnalysisClient(AnalysisProperties props, JsonMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public List<AnalysisFinding> analyze(ProseAnalysisRequest request) {
        return analyze(request, new AtomicBoolean(false));
    }

    @Override
    public List<AnalysisFinding> analyze(ProseAnalysisRequest request, AtomicBoolean abort) {
        if (request.paragraphs().isEmpty()) {
            return List.of();
        }
        if (abort.get() || Thread.currentThread().isInterrupted()) {
            throw new AnalysisAbortedException();
        }
        try {
            return doAnalyze(request, abort);
        } catch (ServiceUnavailableException first) {
            if (abort.get() || Thread.currentThread().isInterrupted()) {
                throw new AnalysisAbortedException();
            }
            log.warn("Analysis backend first attempt failed ({}); retrying once", first.getMessage());
            try {
                Thread.sleep(RETRY_SLEEP_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new AnalysisAbortedException();
            }
            if (abort.get() || Thread.currentThread().isInterrupted()) {
                throw new AnalysisAbortedException();
            }
            return doAnalyze(request, abort);
        }
    }

    private List<AnalysisFinding> doAnalyze(ProseAnalysisRequest request, AtomicBoolean abort) {
        String content = chat(systemPrompt(request), userPrompt(request), abort);
        if (content == null || content.isBlank()) {
            return List.of();
        }
        return parse(content, request.paragraphs());
    }

    private String chat(String system, String user, AtomicBoolean abort) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(message("system", system));
        messages.add(message("user", user));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.model());
        body.put("messages", messages);
        body.put("temperature", 0);
        body.put("max_tokens", 1024);

        log.info("Sending analysis request: model={}, {} message(s)", body.get("model"),
                ((List<?>) body.get("messages")).size());
        try {
            return extractContent(post(body, true, abort).body());
        } catch (HttpFailure e) {
            if (e.status != 400) {
                throw new ServiceUnavailableException("Analysis backend returned status " + e.status);
            }
            try {
                return extractContent(post(body, false, abort).body());
            } catch (HttpFailure retry) {
                throw new ServiceUnavailableException("Analysis backend rejected the request (status " + retry.status + ")");
            } catch (IOException retry) {
                throw unavailable("Analysis backend retry failed", retry);
            }
        } catch (IOException e) {
            throw unavailable("Analysis backend unavailable at " + props.baseUrl(), e);
        }
    }

    private HttpResponse<String> post(Map<String, Object> body, boolean structured, AtomicBoolean abort)
            throws IOException {
        Map<String, Object> payload = new LinkedHashMap<>(body);
        if (structured) {
            payload.put("response_format", Map.of("type", "json_object"));
        }
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(base() + "/v1/chat/completions"))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofMillis(props.timeoutMs()))
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                .build();
        CompletableFuture<HttpResponse<String>> future =
                http.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        while (true) {
            try {
                HttpResponse<String> response = future.get(ABORT_POLL_MS, TimeUnit.MILLISECONDS);
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new HttpFailure(response.statusCode());
                }
                return response;
            } catch (TimeoutException e) {
                if (abort.get() || Thread.currentThread().isInterrupted()) {
                    future.cancel(true);
                    throw new AnalysisAbortedException();
                }
            } catch (CancellationException e) {
                throw new AnalysisAbortedException();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.cancel(true);
                throw new AnalysisAbortedException();
            } catch (ExecutionException e) {
                Throwable cause = e.getCause();
                if (cause instanceof IOException io) {
                    throw io;
                }
                if (cause instanceof RuntimeException re) {
                    throw re;
                }
                throw new IOException(cause);
            }
        }
    }

    private String extractContent(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        try {
            JsonNode choices = mapper.readTree(raw).path("choices");
            JsonNode content = choices.isArray() && !choices.isEmpty()
                    ? choices.get(0).path("message").path("content")
                    : mapper.missingNode();
            return content.isTextual() ? content.asText() : "";
        } catch (Exception e) {
            log.debug("Unexpected analysis backend response", e);
            return "";
        }
    }

    private List<AnalysisFinding> parse(String content, List<String> paragraphs) {
        String json = content.trim();
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return List.of();
        }
        json = json.substring(start, end + 1);
        try {
            JsonNode findings = mapper.readTree(json).path("findings");
            if (!findings.isArray()) {
                return List.of();
            }
            List<AnalysisFinding> out = new ArrayList<>();
            for (JsonNode node : findings) {
                int paragraph = node.path("paragraph").asInt(-1);
                if (paragraph < 0 || paragraph >= paragraphs.size()) {
                    continue;
                }
                String severity = node.path("severity").asText("info");
                if (!SEVERITIES.contains(severity)) {
                    severity = "info";
                }
                String category = node.path("category").asText("");
                if (category.isBlank()) {
                    category = "style";
                }
                String message = node.path("message").asText("").trim();
                if (message.isEmpty()) {
                    continue;
                }
                String reason = node.path("reason").asText("").trim();
                if (reason.isEmpty()) {
                    continue;
                }
                String suggestion = node.path("suggestion").asText("").trim();
                if (suggestion.isEmpty()) {
                    continue;
                }
                int length = paragraphs.get(paragraph).length();
                int from = clamp(node.path("from").asInt(-1), 0, length);
                int to = clamp(node.path("to").asInt(-1), from, length);
                if (from >= to) {
                    continue;
                }
                out.add(new AnalysisFinding(paragraph, from, to, severity, category, message, reason, suggestion));
            }
            return out;
        } catch (Exception e) {
            log.debug("Could not parse analysis findings", e);
            return List.of();
        }
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private String base() {
        return props.baseUrl().replaceAll("/+$", "");
    }

    private Map<String, Object> message(String role, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }

    private String systemPrompt(ProseAnalysisRequest request) {
        String characters = request.characters().isEmpty() ? "none" : String.join(", ", request.characters());
        String lore = request.lore().isEmpty() ? "none" : String.join(", ", request.lore());
        return """
                You are an expert AI copyeditor for a %s story.  The author writes in %s.
                Analyze the provided text for grammatical errors, spelling mistakes, punctuation issues, and
                stylistic improvements.
                
                Context:
                - Characters:
                They might contain an `@` symbol before the name in the text to analyze. Ignore the `@` symbol
                ```
                %s
                ```
                - Lore entries:
                They might contain an `#` symbol before the name in the text to analyze. Ignore the `#` symbol
                ```
                %s
                ```

                Respond ONLY with a JSON object matching this example:
                ```json
                {"findings":[{"paragraph":0,"from":0,"to":5,"severity":"warn","category":"style","message":"...","reason":"...","suggestion":"..."}, ...]}
                ```

                Rules:
                - "paragraph" is the zero-based index of the block in the input, in order.
                - "from" and "to" are zero-based character offsets ("to" exclusive) into that paragraph's own text.
                  Keep each range tight; never span a whole paragraph.
                - "severity" is one of: info, warn, danger.
                - "category" is one of: grammar, style, clarity, consistency, structure.
                - "message" is concise, written in %s.
                - "message" follows language syntax rules.
                - "reason" contains a human explanation of the rule.
                - "suggestion" contains a human suggestion of how to fix the finding.
                - If the prose is clean, return an empty findings array.
                """.formatted(request.storyType(), request.language(), characters, lore, request.language());
    }

    private String userPrompt(ProseAnalysisRequest request) {
        StringBuilder blocks = new StringBuilder();
        for (String paragraph : request.paragraphs()) {
            blocks.append(BLOCK_SEPARATOR).append('\n').append(paragraph).append('\n');
        }
        return "Analyze these blocks of prose. Blocks are separated by a line containing exactly \"" + BLOCK_SEPARATOR
                + "\". Interpret them in order; the first block is paragraph 0.\n\n"
                + "\"```\n"
                + blocks
                + "\"```\n"
                + "\nReturn the JSON object now.";
    }

    private ServiceUnavailableException unavailable(String message, Throwable cause) {
        return new ServiceUnavailableException(message, cause);
    }

    private static final class HttpFailure extends RuntimeException {
        private final int status;

        private HttpFailure(int status) {
            super("backend status " + status);
            this.status = status;
        }
    }
}