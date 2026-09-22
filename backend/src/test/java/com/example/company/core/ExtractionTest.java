package com.example.company.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.company.core.analysis.ProseAnalysisRequest;
import com.example.company.core.extraction.CharacterSuggestion;
import com.example.company.core.extraction.ExtractionClient;
import com.example.company.core.extraction.ExtractionResult;
import com.example.company.core.extraction.LoreSuggestion;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ExtractionTest extends ApiTestBase {

    static final AtomicReference<ProseAnalysisRequest> LAST_REQUEST = new AtomicReference<>();
    static final AtomicReference<List<String>> LAST_TYPES = new AtomicReference<>();

    @TestConfiguration
    static class StubExtractionConfig {
        @Bean
        @Primary
        ExtractionClient stubExtractionClient() {
            return (request, types, abort) -> {
                LAST_REQUEST.set(request);
                LAST_TYPES.set(types);
                return new ExtractionResult(
                        List.of(
                                new CharacterSuggestion("Elian", "A desert wanderer."),
                                new CharacterSuggestion("elian", "The same wanderer, cased differently."),
                                new CharacterSuggestion("Kara the smith", "Forge keeper.")),
                        List.of(
                                new LoreSuggestion("Ashen Waste", "place", "A burned plain south of the village."),
                                new LoreSuggestion("ashen waste", "place", "Same place, cased differently."),
                                new LoreSuggestion("Sundered Horns", "faction", "A raiding band.")));
            };
        }
    }

    @Test
    void ownerGetsCharacterAndLoreSuggestions() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Extracted", "NOVEL");

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"Elian crossed the Ashen Waste.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        var extracted = json(extract(story, nodeId, alice));

        assertThat(extracted.get("nodeId").longValue()).isEqualTo(nodeId);
        assertThat(extracted.get("model").asText()).isEqualTo("llama3.1");
        assertThat(extracted.get("characters")).hasSize(2);
        assertThat(extracted.get("characters").get(0).get("name").asText()).isEqualTo("Elian");
        assertThat(extracted.get("characters").get(1).get("name").asText()).isEqualTo("Kara the smith");
        assertThat(extracted.get("lore")).hasSize(2);
        assertThat(extracted.get("lore").get(0).get("title").asText()).isEqualTo("Ashen Waste");
        assertThat(extracted.get("lore").get(0).get("category").asText()).isEqualTo("place");
        assertThat(extracted.get("lore").get(1).get("title").asText()).isEqualTo("Sundered Horns");
    }

    @Test
    void viewerCannotExtractFromDrafts() throws Exception {
        long alice = newUser("a@test.example").id();
        long bob = newUser("b@test.example").id();
        long story = createStory(alice, "Gated extraction", "NOVEL");

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"b@test.example\",\"role\":\"VIEWER\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes/" + nodeId + "/extract")
                        .header("X-User-Id", bob))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
    }

    @Test
    void existingEntitiesArePassedToTheModel() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Dedupe", "NOVEL");
        LAST_REQUEST.set(null);

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/characters")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Elian\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated());
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/lore")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Ashen Waste\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated());

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"Elian crossed the Ashen Waste.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        json(extract(story, nodeId, alice));

        ProseAnalysisRequest request = LAST_REQUEST.get();
        assertThat(request).isNotNull();
        assertThat(request.characters()).containsExactly("Elian");
        assertThat(request.lore()).containsExactly("Ashen Waste");
        assertThat(request.paragraphs()).hasSize(1);
    }

    @Test
    void loreOnlyRequestFiltersSuggestionsToLore() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Lore only", "NOVEL");
        LAST_TYPES.set(null);

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"Elian crossed the Ashen Waste.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        MvcResult pending = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes/" + nodeId + "/extract")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"types\":[\"lore\"]}"))
                .andExpect(MockMvcResultMatchers.request().asyncStarted())
                .andReturn();

        var extracted = json(mvc.perform(MockMvcRequestBuilders.asyncDispatch(pending))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());

        assertThat(LAST_TYPES.get()).containsExactly("lore");
        assertThat(extracted.get("characters")).isEmpty();
        assertThat(extracted.get("lore")).hasSize(2);
        assertThat(extracted.get("lore").get(0).get("title").asText()).isEqualTo("Ashen Waste");
        assertThat(extracted.get("lore").get(1).get("title").asText()).isEqualTo("Sundered Horns");
    }

    @Test
    void alreadyCreatedEntitiesAreFilteredFromSuggestions() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Filtered", "NOVEL");

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/characters")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Elian\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated());
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/lore")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"ashen waste\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated());

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"Elian and Kara crossed the Ashen Waste.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        var extracted = json(extract(story, nodeId, alice));

        assertThat(extracted.get("characters")).hasSize(1);
        assertThat(extracted.get("characters").get(0).get("name").asText()).isEqualTo("Kara the smith");
        assertThat(extracted.get("lore")).hasSize(1);
        assertThat(extracted.get("lore").get(0).get("title").asText()).isEqualTo("Sundered Horns");
    }

    @Test
    void emptyProseShortCircuitsWithoutCallingClient() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Empty", "NOVEL");

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        var extracted = json(extract(story, nodeId, alice));

        assertThat(extracted.get("characters")).isEmpty();
        assertThat(extracted.get("lore")).isEmpty();
    }

    @Test
    void payloadDocOverridesSavedBody() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Live extraction", "NOVEL");

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        MvcResult pending = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes/" + nodeId + "/extract")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"doc\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":"
                                + "[{\"type\":\"text\",\"text\":\"Kara the smith.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.request().asyncStarted())
                .andReturn();

        var extracted = json(mvc.perform(MockMvcRequestBuilders.asyncDispatch(pending))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());

        assertThat(extracted.get("characters")).hasSize(2);
        assertThat(extracted.get("characters").get(0).get("name").asText()).isEqualTo("Elian");
        assertThat(extracted.get("characters").get(1).get("name").asText()).isEqualTo("Kara the smith");
    }
}