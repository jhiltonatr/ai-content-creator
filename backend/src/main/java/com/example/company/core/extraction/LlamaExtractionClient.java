package com.example.company.core.extraction;

import com.example.company.core.analysis.AnalysisAbortedException;
import com.example.company.core.analysis.AnalysisProperties;
import com.example.company.core.analysis.ProseAnalysisRequest;
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
public class LlamaExtractionClient implements ExtractionClient {

    private static final Logger log = LoggerFactory.getLogger(LlamaExtractionClient.class);
    private static final String BLOCK_SEPARATOR = "====";
    private static final int MAX_SUGGESTIONS = 30;
    private static final long RETRY_SLEEP_MS = 3000;
    private static final long ABORT_POLL_MS = 50;

    private final AnalysisProperties props;
    private final JsonMapper mapper;
    private final HttpClient http;

    public LlamaExtractionClient(AnalysisProperties props, JsonMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public ExtractionResult extract(ProseAnalysisRequest request, List<String> types, AtomicBoolean abort) {
        if (request.paragraphs().isEmpty()) {
            return new ExtractionResult(List.of(), List.of());
        }
        if (abort.get() || Thread.currentThread().isInterrupted()) {
            throw new AnalysisAbortedException();
        }
        try {
            return doExtract(request, types, abort);
        } catch (ServiceUnavailableException first) {
            if (abort.get() || Thread.currentThread().isInterrupted()) {
                throw new AnalysisAbortedException();
            }
            log.warn("Extraction backend first attempt failed ({}); retrying once", first.getMessage());
            try {
                Thread.sleep(RETRY_SLEEP_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new AnalysisAbortedException();
            }
            if (abort.get() || Thread.currentThread().isInterrupted()) {
                throw new AnalysisAbortedException();
            }
            return doExtract(request, types, abort);
        }
    }

    private ExtractionResult doExtract(ProseAnalysisRequest request, List<String> types, AtomicBoolean abort) {
        String content = chat(systemPrompt(request, types), userPrompt(request, types), abort);
        if (content == null || content.isBlank()) {
            return new ExtractionResult(List.of(), List.of());
        }
        return parse(content, types);
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

        log.info("Sending extraction request: model={}, {} message(s)", body.get("model"),
                ((List<?>) body.get("messages")).size());
        try {
            return extractContent(post(body, true, abort).body());
        } catch (HttpFailure e) {
            if (e.status != 400) {
                throw new ServiceUnavailableException("Extraction backend returned status " + e.status);
            }
            try {
                return extractContent(post(body, false, abort).body());
            } catch (HttpFailure retry) {
                throw new ServiceUnavailableException(
                        "Extraction backend rejected the request (status " + retry.status + ")");
            } catch (IOException retry) {
                throw unavailable("Extraction backend retry failed", retry);
            }
        } catch (IOException e) {
            throw unavailable("Extraction backend unavailable at " + props.baseUrl(), e);
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
            log.debug("Unexpected extraction backend response", e);
            return "";
        }
    }

    private ExtractionResult parse(String content, List<String> types) {
        String json = content.trim();
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return new ExtractionResult(List.of(), List.of());
        }
        json = json.substring(start, end + 1);
        try {
            JsonNode root = mapper.readTree(json);
            List<CharacterSuggestion> characters =
                    types.contains("characters") ? parseCharacters(root.path("characters")) : List.of();
            List<LoreSuggestion> lore = types.contains("lore") ? parseLore(root.path("lore")) : List.of();
            return new ExtractionResult(characters, lore);
        } catch (Exception e) {
            log.debug("Could not parse extraction suggestions", e);
            return new ExtractionResult(List.of(), List.of());
        }
    }

    private List<CharacterSuggestion> parseCharacters(JsonNode array) {
        List<CharacterSuggestion> out = new ArrayList<>();
        if (!array.isArray()) {
            return out;
        }
        for (JsonNode node : array) {
            String name = node.path("name").asText("").trim();
            if (name.isEmpty()) {
                continue;
            }
            out.add(new CharacterSuggestion(name, node.path("bio").asText("").trim()));
            if (out.size() >= MAX_SUGGESTIONS) {
                break;
            }
        }
        return out;
    }

    private List<LoreSuggestion> parseLore(JsonNode array) {
        List<LoreSuggestion> out = new ArrayList<>();
        if (!array.isArray()) {
            return out;
        }
        for (JsonNode node : array) {
            String title = node.path("title").asText("").trim();
            if (title.isEmpty()) {
                continue;
            }
            out.add(new LoreSuggestion(title, node.path("category").asText("").trim(),
                    node.path("body").asText("").trim()));
            if (out.size() >= MAX_SUGGESTIONS) {
                break;
            }
        }
        return out;
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

    private String systemPrompt(ProseAnalysisRequest request, List<String> types) {
        boolean wantCharacters = types.contains("characters");
        boolean wantLore = types.contains("lore");
        String requested = wantCharacters && wantLore ? "characters and lore" : wantCharacters ? "characters only" : "lore only";

        String kinds = (wantCharacters
                ? """
                  - Characters: named beings (people, creatures, ...) that could appear again.
                    In the text a character may be written with a leading `@`.  Ignore that symbol when recording names.
                  """
                : "") + (wantLore
                ? """
                  - Lore: named places, objects, factions, concepts, or traditions worth remembering.
                    In the text a lore entry may be written with a leading `#`.  Ignore that symbol when recording names.
                  """
                : "");

        StringBuilder example = new StringBuilder("```json\n{");
        if (wantCharacters) {
            example.append("\"characters\":[{\"name\":\"...\",\"bio\":\"...\"}]");
        }
        if (wantCharacters && wantLore) {
            example.append(',');
        }
        if (wantLore) {
            example.append("\"lore\":[{\"title\":\"...\",\"category\":\"...\",\"body\":\"...\"}]");
        }
        example.append("}\n```");

        StringBuilder rules = new StringBuilder();
        if (wantCharacters) {
            rules.append("- \"bio\" is one concise sentence, written in ").append(request.language()).append(".\n");
        }
        if (wantLore) {
            rules.append(
                            "- \"category\" for lore is one of: place, object, faction, concept, tradition (or omit if unsure).\n")
                    .append("- \"body\" is two or three sentences of insight, written in ")
                    .append(request.language())
                    .append(".\n");
        }

        return """
                You are a world building assistant for a story.
                Extract %s from the text.

                Kinds of entities:
                %s
                Context:
                - Existing characters: %s
                - Existing lore: %s

                Respond ONLY with a JSON object matching this example:
                %s

                Rules:
                - Do not repeat entities already listed in the existing characters / existing lore.
                - Return no element types other than the requested ones.
                %s- If nothing is worth extracting, return empty arrays.
                - Return the JSON object only, with no other text.
                """.formatted(
                requested,
                kinds,
                shortList(request.characters()),
                shortList(request.lore()),
                example,
                rules);
    }

    private String userPrompt(ProseAnalysisRequest request, List<String> types) {
        boolean wantCharacters = types.contains("characters");
        boolean wantLore = types.contains("lore");
        String asked = wantCharacters && wantLore
                ? "characters and lore"
                : wantCharacters ? "characters" : "lore";
        StringBuilder blocks = new StringBuilder();
        for (String paragraph : request.paragraphs()) {
            blocks.append(BLOCK_SEPARATOR).append('\n').append(paragraph).append('\n');
        }
        return "Extract unique " + asked + " from these blocks of prose. "
            + "Blocks are separated by a line containing "
            + "exactly \"" + BLOCK_SEPARATOR + "\".\n\n"
            + "The author writes in " + request.language()
            + "\"```\n"
            + blocks
            + "\"```\n"
            + "\nReturn the JSON object now.";
    }

    private String shortList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "none";
        }
        List<String> trimmed = values.stream()
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .limit(200)
                .toList();
        return trimmed.isEmpty() ? "none" : String.join(", ", trimmed);
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