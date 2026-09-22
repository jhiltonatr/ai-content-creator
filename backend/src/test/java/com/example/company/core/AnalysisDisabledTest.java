package com.example.company.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.company.core.analysis.AnalysisClient;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;

@Transactional
@TestPropertySource(properties = "storyforge.analysis.enabled=false")
class AnalysisDisabledTest extends ApiTestBase {

    @TestConfiguration
    static class DisabledAnalysisConfig {
        @Bean
        @Primary
        AnalysisClient wouldHaveBeenCalledClient() {
            return request -> {
                throw new IllegalStateException("Analysis client must not run while disabled");
            };
        }
    }

    @Test
    void disabledAnalysisSkipsTheClientAndReportsEnabledFalse() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Disabled AI", "NOVEL");

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"The the very old village.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        MvcResult pending = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes/" + nodeId + "/analyze")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.request().asyncStarted())
                .andReturn();

        var analyzed = json(mvc.perform(MockMvcRequestBuilders.asyncDispatch(pending))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());

        assertThat(analyzed.get("enabled").booleanValue()).isFalse();
        assertThat(analyzed.get("findings")).isEmpty();
        assertThat(analyzed.get("paragraphs")).hasSize(1);
        assertThat(analyzed.get("paragraphs").get(0).asText()).isEqualTo("The the very old village.");
    }
}