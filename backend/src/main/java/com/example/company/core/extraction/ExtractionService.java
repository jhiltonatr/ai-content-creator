package com.example.company.core.extraction;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.analysis.AnalysisProperties;
import com.example.company.core.analysis.ProseAnalysisRequest;
import com.example.company.core.analysis.ProseExtractor;
import com.example.company.core.character.CharacterRecord;
import com.example.company.core.character.CharacterRepository;
import com.example.company.core.common.NotFoundException;
import com.example.company.core.lore.LoreRecord;
import com.example.company.core.lore.LoreRepository;
import com.example.company.core.node.NodeFull;
import com.example.company.core.node.NodeRepository;
import com.example.company.core.story.StoryRecord;
import com.example.company.core.story.StoryRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class ExtractionService {

    private final AccessChecker access;
    private final StoryRepository stories;
    private final NodeRepository nodes;
    private final CharacterRepository characters;
    private final LoreRepository lore;
    private final ProseExtractor extractor;
    private final ExtractionClient client;
    private final ExtractionProperties props;
    private final AnalysisProperties llm;

    public ExtractionService(
            AccessChecker access,
            StoryRepository stories,
            NodeRepository nodes,
            CharacterRepository characters,
            LoreRepository lore,
            ProseExtractor extractor,
            ExtractionClient client,
            ExtractionProperties props,
            AnalysisProperties llm) {
        this.access = access;
        this.stories = stories;
        this.nodes = nodes;
        this.characters = characters;
        this.lore = lore;
        this.extractor = extractor;
        this.client = client;
        this.props = props;
        this.llm = llm;
    }

    private static final String CHARACTERS = "characters";
    private static final String LORE = "lore";

    public record PreparedExtraction(
            long storyId,
            long nodeId,
            String storyType,
            String language,
            List<String> characters,
            List<String> lore,
            List<String> paragraphs,
            List<String> types) {}

    static List<String> normalizeTypes(ExtractionRequest request) {
        if (request == null || request.types() == null || request.types().isEmpty()) {
            return List.of(CHARACTERS, LORE);
        }
        List<String> out = new ArrayList<>();
        for (String type : request.types()) {
            if ((CHARACTERS.equals(type) || LORE.equals(type)) && !out.contains(type)) {
                out.add(type);
            }
        }
        return out.isEmpty() ? List.of(CHARACTERS, LORE) : List.copyOf(out);
    }

    public PreparedExtraction prepare(long userId, long storyId, long nodeId, ExtractionRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        StoryRecord story = stories.require(storyId);
        NodeFull node = nodes.findById(storyId, nodeId)
                .orElseThrow(() -> new NotFoundException("Node " + nodeId + " not found in story"));

        JsonNode body = request != null && request.doc() != null ? request.doc() : node.body();
        List<String> paragraphs = limit(extractor.paragraphs(body));

        List<String> characterNames = characters.listForStory(storyId).stream()
                .map(CharacterRecord::name)
                .toList();
        List<String> loreTitles =
                lore.listForStory(storyId).stream().map(LoreRecord::title).toList();
        String language = node.language() == null || node.language().isBlank() ? story.defaultLanguage() : node.language();
        if (language == null || language.isBlank()) {
            language = "en";
        }

        return new PreparedExtraction(
                storyId,
                nodeId,
                story.storyType().name(),
                language,
                characterNames,
                loreTitles,
                paragraphs,
                normalizeTypes(request));
    }

    public ExtractionResponse run(PreparedExtraction prepared, AtomicBoolean abort) {
        boolean enabled = props.enabled();
        ExtractionResult result = !enabled || prepared.paragraphs().isEmpty()
                ? new ExtractionResult(List.of(), List.of())
                : client.extract(new ProseAnalysisRequest(
                        prepared.storyId(),
                        prepared.nodeId(),
                        prepared.storyType(),
                        prepared.language(),
                        prepared.characters(),
                        prepared.lore(),
                        prepared.paragraphs()),
                        prepared.types(),
                        abort);
        List<CharacterSuggestion> characters = filterCharacters(
                prepared.types(), prepared.characters(), result.characters());
        List<LoreSuggestion> lore = filterLore(prepared.types(), prepared.lore(), result.lore());
        return new ExtractionResponse(
                prepared.nodeId(),
                prepared.storyId(),
                llm.model(),
                enabled,
                Instant.now(),
                characters,
                lore);
    }

    private List<CharacterSuggestion> filterCharacters(
            List<String> types, List<String> existingNames, List<CharacterSuggestion> suggestions) {
        if (!types.contains(CHARACTERS)) {
            return List.of();
        }
        Set<String> known = new HashSet<>();
        for (String existing : existingNames) {
            known.add(normalize(existing));
        }
        List<CharacterSuggestion> out = new ArrayList<>();
        for (CharacterSuggestion suggestion : suggestions) {
            if (suggestion == null || suggestion.name() == null) {
                continue;
            }
            if (known.add(normalize(suggestion.name()))) {
                out.add(suggestion);
            }
        }
        return out;
    }

    private List<LoreSuggestion> filterLore(List<String> types, List<String> existingTitles, List<LoreSuggestion> suggestions) {
        if (!types.contains(LORE)) {
            return List.of();
        }
        Set<String> known = new HashSet<>();
        for (String existing : existingTitles) {
            known.add(normalize(existing));
        }
        List<LoreSuggestion> out = new ArrayList<>();
        for (LoreSuggestion suggestion : suggestions) {
            if (suggestion == null || suggestion.title() == null) {
                continue;
            }
            if (known.add(normalize(suggestion.title()))) {
                out.add(suggestion);
            }
        }
        return out;
    }

    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private List<String> limit(List<String> paragraphs) {
        List<String> result = new ArrayList<>();
        for (String paragraph : paragraphs) {
            if (result.size() >= llm.maxParagraphs()) {
                break;
            }
            if (paragraph.length() > llm.maxParagraphChars()) {
                paragraph = paragraph.substring(0, llm.maxParagraphChars());
            }
            result.add(paragraph);
        }
        return result;
    }
}