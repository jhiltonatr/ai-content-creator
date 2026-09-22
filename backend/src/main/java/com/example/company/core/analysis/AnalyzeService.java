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

    public AnalyzeResponse analyze(long userId, long storyId, long nodeId, AnalyzeRequest analyzeRequest) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        StoryRecord story = stories.require(storyId);
        NodeFull node = nodes.findById(storyId, nodeId)
                .orElseThrow(() -> new NotFoundException("Node " + nodeId + " not found in story"));

        JsonNode body = analyzeRequest != null && analyzeRequest.doc() != null ? analyzeRequest.doc() : node.body();
        List<String> paragraphs = limit(extractor.paragraphs(body));
        if (paragraphs.isEmpty()) {
            return new AnalyzeResponse(nodeId, storyId, props.model(), Instant.now(), List.of(), List.of());
        }

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

        ProseAnalysisRequest request = new ProseAnalysisRequest(
                storyId, nodeId, story.storyType().name(), language, characterNames, loreTitles, paragraphs);

        List<AnalysisFinding> findings = client.analyze(request);
        return new AnalyzeResponse(nodeId, storyId, props.model(), Instant.now(), paragraphs, findings);
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
