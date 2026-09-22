package com.example.company.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.company.core.analysis.AnalysisClient;
import com.example.company.core.analysis.AnalysisFinding;
import java.util.List;
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
class AnalysisTest extends ApiTestBase {

    @TestConfiguration
    static class StubAnalysisConfig {
        @Bean
        @Primary
        AnalysisClient stubAnalysisClient() {
            return request -> List.of(new AnalysisFinding(
                    0, 0, 10, "warn", "style", "Repeated word.", "Rule explains the finding.", "Rewrite it."));
        }
    }

    @Test
    void ownerGetsFindingsAndParagraphs() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Analyzed", "NOVEL");

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"The the very old village.\"}]},"
                                + "{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"Elian walked.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        var analyzed = json(analyze(story, nodeId, alice));

        assertThat(analyzed.get("nodeId").longValue()).isEqualTo(nodeId);
        assertThat(analyzed.get("model").asText()).isEqualTo("llama3.1");
        assertThat(analyzed.get("paragraphs")).hasSize(2);
        assertThat(analyzed.get("findings")).hasSize(1);
        assertThat(analyzed.get("findings").get(0).get("paragraph").intValue()).isZero();
        assertThat(analyzed.get("findings").get(0).get("message").asText()).isEqualTo("Repeated word.");
    }

    @Test
    void viewerCannotAnalyzeDrafts() throws Exception {
        long alice = newUser("a@test.example").id();
        long bob = newUser("b@test.example").id();
        long story = createStory(alice, "Gated analysis", "NOVEL");

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

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes/" + nodeId + "/analyze")
                        .header("X-User-Id", bob))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
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

        var analyzed = json(analyze(story, nodeId, alice));

        assertThat(analyzed.get("findings")).isEmpty();
        assertThat(analyzed.get("paragraphs")).isEmpty();
    }

    @Test
    void payloadDocOverridesSavedBody() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Live analysis", "NOVEL");

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"Saved body text.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        var analyzed = json(analyze(MockMvcRequestBuilders
                .post("/api/stories/" + story + "/nodes/" + nodeId + "/analyze")
                .header("X-User-Id", alice)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"doc\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\""
                        + ":\"text\",\"text\":\"Cake was eaten.\"}]}]}}")));

        assertThat(analyzed.get("paragraphs")).hasSize(1);
        assertThat(analyzed.get("paragraphs").get(0).asText()).isEqualTo("Cake was eaten.");
        assertThat(analyzed.get("findings")).hasSize(1);
    }
}
