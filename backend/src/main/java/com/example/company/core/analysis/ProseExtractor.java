package com.example.company.core.analysis;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class ProseExtractor {

    public List<String> paragraphs(JsonNode body) {
        List<String> paragraphs = new ArrayList<>();
        if (body != null) {
            walk(body, paragraphs);
        }
        return paragraphs;
    }

    private void walk(JsonNode node, List<String> paragraphs) {
        String type = node.path("type").asText("");
        if (type.equals("paragraph") || type.equals("heading") || type.equals("codeBlock")) {
            String text = render(node.path("content"));
            if (!text.isBlank()) {
                paragraphs.add(text);
            }
            return;
        }
        JsonNode content = node.path("content");
        if (content.isArray()) {
            for (JsonNode child : content) {
                walk(child, paragraphs);
            }
        }
    }

    private String render(JsonNode content) {
        StringBuilder out = new StringBuilder();
        if (!content.isArray()) {
            return out.toString();
        }
        for (JsonNode child : content) {
            String type = child.path("type").asText("");
            switch (type) {
                case "text" -> out.append(child.path("text").asText(""));
                case "mention" -> {
                    String trigger =
                            child.path("attrs").path("mentionSuggestionChar").asText("@");
                    String label = child.path("attrs")
                            .path("label")
                            .asText(child.path("attrs").path("id").asText(""));
                    out.append(trigger).append(label);
                }
                case "hardBreak" -> out.append('\n');
                default -> out.append(' ');
            }
        }
        return out.toString();
    }
}
