package com.example.company.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.company.core.analysis.AnalysisClient;
import com.example.company.core.common.ServiceUnavailableException;
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
class AnalysisUnavailableTest extends ApiTestBase {

    @TestConfiguration
    static class FailingAnalysisConfig {
        @Bean
        @Primary
        AnalysisClient failingAnalysisClient() {
            return request -> {
                throw new ServiceUnavailableException("Analysis backend unavailable");
            };
        }
    }

    @Test
    void unreachableAnalysisBackendMapsTo503() throws Exception {
        long alice = newUser("a@test.example").id();
        long story = createStory(alice, "Unavailable", "NOVEL");

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Target\",\"body\":{\"type\":\"doc\","
                                + "\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\","
                                + "\"text\":\"Machine hummed and hummed.\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long nodeId = json(created).get("id").longValue();

        MvcResult pending = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes/" + nodeId + "/analyze")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.request().asyncStarted())
                .andReturn();

        var result =
                json(mvc.perform(MockMvcRequestBuilders.asyncDispatch(pending))
                        .andExpect(MockMvcResultMatchers.status().isServiceUnavailable())
                        .andReturn());

        assertThat(result.get("error").get("code").asText()).isEqualTo("SERVICE_UNAVAILABLE");
    }
}
