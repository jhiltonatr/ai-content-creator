package com.example.company.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.company.core.extraction.ExtractionClient;
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
@TestPropertySource(properties = "storyforge.extraction.enabled=false")
class ExtractionDisabledTest extends ApiTestBase {

    @TestConfiguration
    static class DisabledExtractionConfig {
        @Bean
        @Primary
        ExtractionClient wouldHaveBeenCalledClient() {
            return (request, types, abort) -> {
                throw new IllegalStateException("Extraction client must not run while disabled");
            };
        }
    }

    @Test
    void disabledExtractionSkipsTheClientAndReportsEnabledFalse() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Disabled AI", "NOVEL");

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
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.request().asyncStarted())
                .andReturn();

        var extracted = json(mvc.perform(MockMvcRequestBuilders.asyncDispatch(pending))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());

        assertThat(extracted.get("enabled").booleanValue()).isFalse();
        assertThat(extracted.get("characters")).isEmpty();
        assertThat(extracted.get("lore")).isEmpty();
    }
}