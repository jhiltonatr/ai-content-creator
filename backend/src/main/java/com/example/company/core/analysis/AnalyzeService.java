package com.example.company.core.analysis;

import com.example.company.core.access.AccessChecker;
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
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AnalyzeService {

    private final AccessChecker access;
    private final StoryRepository stories;
    private final NodeRepository nodes;
    private final CharacterRepository characters;
    private final LoreRepository lore;
    private final ProseExtractor extractor;
    private final AnalysisClient client;
    private final AnalysisProperties props;

    public AnalyzeService(
            AccessChecker access,
            StoryRepository stories,
            NodeRepository nodes,
            CharacterRepository characters,
            LoreRepository lore,
            ProseExtractor extractor,
            AnalysisClient client,
            AnalysisProperties props) {
        this.access = access;
        this.stories = stories;
        this.nodes = nodes;
        this.characters = characters;
        this.lore = lore;
        this.extractor = extractor;
        this.client = client;
        this.props = props;
    }

    public record PreparedAnalysis(
            long storyId,
            long nodeId,
            String storyType,
            String language,
            List<String> characters,
            List<String> lore,
            List<String> paragraphs) {}

    public PreparedAnalysis prepare(long userId, long storyId, long nodeId, AnalyzeRequest analyzeRequest) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        StoryRecord story = stories.require(storyId);
        NodeFull node = nodes.findById(storyId, nodeId)
                .orElseThrow(() -> new NotFoundException("Node " + nodeId + " not found in story"));

        JsonNode body = analyzeRequest != null && analyzeRequest.doc() != null ? analyzeRequest.doc() : node.body();
        List<String> paragraphs = limit(extractor.paragraphs(body));

        List<String> characterNames = characters.listForStory(storyId).stream()
                .map(CharacterRecord::name)
                .toList();
        List<String> loreTitles =
                lore.listForStory(storyId).stream().map(LoreRecord::title).toList();
        String language =
                node.language() == null || node.language().isBlank() ? story.defaultLanguage() : node.language();
        if (language == null || language.isBlank()) {
            language = "en";
        }

        return new PreparedAnalysis(
                storyId, nodeId, story.storyType().name(), language, characterNames, loreTitles, paragraphs);
    }

    public AnalyzeResponse run(PreparedAnalysis prepared, AtomicBoolean abort) {
        boolean enabled = props.enabled();
        List<AnalysisFinding> findings = !enabled || prepared.paragraphs().isEmpty()
                ? List.of()
                : client.analyze(new ProseAnalysisRequest(
                        prepared.storyId(),
                        prepared.nodeId(),
                        prepared.storyType(),
                        prepared.language(),
                        prepared.characters(),
                        prepared.lore(),
                        prepared.paragraphs()),
                        abort);
        return new AnalyzeResponse(
                prepared.nodeId(),
                prepared.storyId(),
                props.model(),
                enabled,
                Instant.now(),
                prepared.paragraphs(),
                findings);
    }

    private List<String> limit(List<String> paragraphs) {
        List<String> result = new ArrayList<>();
        for (String paragraph : paragraphs) {
            if (result.size() >= props.maxParagraphs()) {
                break;
            }
            if (paragraph.length() > props.maxParagraphChars()) {
                paragraph = paragraph.substring(0, props.maxParagraphChars());
            }
            result.add(paragraph);
        }
        return result;
    }
}
