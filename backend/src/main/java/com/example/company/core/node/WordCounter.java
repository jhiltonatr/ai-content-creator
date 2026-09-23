package com.example.company.core.node;

import tools.jackson.databind.JsonNode;

/**
 * Word counts derived from node content (TipTap doc JSON in {@code body},
 * script-block JSON in {@code script}). Mirrors the client-side counters in
 * {@code ui/src/lib/words.ts} so tree totals and live editor counts agree.
 */
public final class WordCounter {

    private WordCounter() {
    }

    public static int count(JsonNode body, JsonNode script) {
        return countBody(body) + countScript(script);
    }

    public static int countBody(JsonNode body) {
        if (body == null || body.isNull()) {
            return 0;
        }
        StringBuilder text = new StringBuilder();
        collectText(body, text);
        return words(text.toString());
    }

    public static int countScript(JsonNode script) {
        if (script == null || script.isNull() || !script.isObject()) {
            return 0;
        }
        int total = words(script.path("sceneHeading").asText(""));
        JsonNode actionLines = script.path("actionLines");
        if (actionLines.isArray()) {
            for (JsonNode line : actionLines) {
                total += words(line.asText(""));
            }
        }
        JsonNode dialogue = script.path("dialogue");
        if (dialogue.isArray()) {
            for (JsonNode beat : dialogue) {
                total += countBeat(beat);
            }
        } else if (dialogue.isObject()) {
            total += countBeat(dialogue);
        }
        return total;
    }

    private static int countBeat(JsonNode beat) {
        int total = words(beat.path("characterName").asText(""));
        total += words(beat.path("parenthetical").asText(""));
        total += words(beat.path("line").asText(""));
        return total;
    }

    private static void collectText(JsonNode node, StringBuilder out) {
        String type = node.path("type").asText("");
        if (type.equals("text")) {
            out.append(node.path("text").asText("")).append(' ');
        } else if (type.equals("mention")) {
            JsonNode attrs = node.path("attrs");
            String label = attrs.path("label").asText(attrs.path("id").asText(""));
            out.append(label).append(' ');
        }
        JsonNode content = node.path("content");
        if (content.isArray()) {
            for (JsonNode child : content) {
                collectText(child, out);
            }
        }
    }

    public static int words(String text) {
        if (text == null) {
            return 0;
        }
        String trimmed = text.trim();
        if (trimmed.isEmpty()) {
            return 0;
        }
        return trimmed.split("\\s+").length;
    }
}