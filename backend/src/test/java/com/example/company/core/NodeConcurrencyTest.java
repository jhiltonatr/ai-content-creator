package com.example.company.core;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class NodeConcurrencyTest extends ApiTestBase {

    @Test
    void optimisticWriteSucceedsIdempotentlyAndConflictsWhenStale() throws Exception {
        long alice = newUser("alice@test.example").id();
        long story = createStory(alice, "Concurrency", "NOVEL");

        String createBody = "{\"nodeType\":\"CHAPTER\",\"title\":\"One\"}";
        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();

        JsonNode node = json(created);
        long nodeId = node.get("id").longValue();
        assertThat(node.get("version").longValue()).isEqualTo(1);
        assertThat(node.get("status").asText()).isEqualTo("DRAFT");

        String firstFlush = "{\"expectedVersion\":1,\"changeId\":\"first\",\"payload\":{\"type\":\"doc\"}}";
        MvcResult first = mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(firstFlush))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertThat(json(first).get("version").longValue()).isEqualTo(2);

        String staleFlush = "{\"expectedVersion\":1,\"changeId\":\"mid\",\"payload\":{\"type\":\"doc\"}}";
        MvcResult conflict = mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staleFlush))
                .andExpect(MockMvcResultMatchers.status().isConflict())
                .andReturn();
        JsonNode conflictBody = json(conflict);
        assertThat(conflictBody.get("error").get("code").asText()).isEqualTo("CONFLICT");
        assertThat(conflictBody.get("current").get("version").longValue()).isEqualTo(2);

        String resolvedFlush = "{\"expectedVersion\":2,\"changeId\":\"final\",\"payload\":{\"type\":\"doc\"}}";
        MvcResult resolved = mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resolvedFlush))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertThat(json(resolved).get("version").longValue()).isEqualTo(3);

        // replaying the same changeId must be a no-op that does not bump the version again
        String replay = "{\"expectedVersion\":3,\"changeId\":\"final\",\"payload\":{\"type\":\"doc\"}}";
        MvcResult replayResult = mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replay))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertThat(json(replayResult).get("version").longValue()).isEqualTo(3);
        assertThat(json(replayResult).get("lastChangeId").asText()).isEqualTo("final");
    }

    @Test
    void archetypeRejectsImpossibleNesting() throws Exception {
        long alice = newUser("alice2@test.example").id();
        long story = createStory(alice, "Archetype", "NOVEL");

        MvcResult badRoot = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"SCENE\",\"title\":\"Root scene\"}"))
                .andExpect(MockMvcResultMatchers.status().isBadRequest())
                .andReturn();
        assertThat(json(badRoot).get("error").get("code").asText()).isEqualTo("BAD_REQUEST");

        long chapter = json(mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Chapter\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn()).get("id").longValue();

        MvcResult badChild = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"BOOK\",\"title\":\"Nested book\",\"parentId\":" + chapter + "}"))
                .andExpect(MockMvcResultMatchers.status().isBadRequest())
                .andReturn();
        assertThat(json(badChild).get("error").get("code").asText()).isEqualTo("BAD_REQUEST");

        MvcResult validScene = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"SCENE\",\"title\":\"A scene\",\"parentId\":" + chapter + "}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        assertThat(json(validScene).get("kind").asText()).isEqualTo("SCENE");
    }
}