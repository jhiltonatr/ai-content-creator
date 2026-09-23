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
class ReleaseVersionTest extends ApiTestBase {

    private long newChapter(long userId, long storyId, String title) throws Exception {
        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/nodes")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"" + title + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(created).get("id").longValue();
    }

    private void markDone(long userId, long storyId, long nodeId, long version) throws Exception {
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + storyId + "/nodes/" + nodeId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + version + ",\"changeId\":\"done-" + nodeId + "-"
                                + version + "\",\"status\":\"DONE\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    private long publish(long userId, long storyId, String name) throws Exception {
        MvcResult result = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/releases")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(result).get("id").longValue();
    }

    @Test
    void releasePinsNodeVersionsAndLinksExactCheckpoints() throws Exception {
        long alice = newUser("alice-rel@test.example").id();
        long story = createStory(alice, "Versioned", "NOVEL");
        long doneNode = newChapter(alice, story, "Published chapter");
        newChapter(alice, story, "Working draft");

        markDone(alice, story, doneNode, 1);
        MvcResult checkpoint = mvc.perform(MockMvcRequestBuilders.post(
                        "/api/stories/" + story + "/nodes/" + doneNode + "/checkpoints")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"Ready\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long checkpointId = json(checkpoint).get("id").longValue();

        publish(alice, story, "First");
        JsonNode captured = json(mvc.perform(MockMvcRequestBuilders.get(
                        "/api/stories/" + story + "/releases")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        JsonNode nodes = captured.get(0).get("nodes");
        assertThat(nodes.size()).isEqualTo(1);
        assertThat(nodes.get(0).get("id").longValue()).isEqualTo(doneNode);
        assertThat(nodes.get(0).get("version").longValue()).isEqualTo(2);
        assertThat(nodes.get(0).get("checkpointId").longValue()).isEqualTo(checkpointId);
    }

    @Test
    void viewersSeeOnlyTheLatestReleasedVersion() throws Exception {
        long alice = newUser("alice-vv@test.example").id();
        long viewer = newUser("viewer-rel@test.example").id();
        long story = createStory(alice, "ViewerGate", "NOVEL");

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"viewer-rel@test.example\",\"role\":\"VIEWER\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        long chapter = newChapter(alice, story, "First chapter");
        markDone(alice, story, chapter, 1);
        publish(alice, story, "v1");

        // newer working revision exists but is draft-only; publish again to create v2
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + chapter + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":2,\"changeId\":\"edit-1\","
                                + "\"payload\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\","
                                + "\"content\":[{\"type\":\"text\",\"text\":\"edits never shown to viewers\"}]}]}}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        publish(alice, story, "v2");

        JsonNode latest = json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/releases/latest")
                        .header("X-User-Id", viewer))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        assertThat(latest.get("version").intValue()).isEqualTo(2);
        assertThat(latest.get("nodes").get(0).get("version").longValue()).isEqualTo(3);
        assertThat(latest.get("nodes").get(0).get("body").get("content").get(0).get("content").get(0)
                .get("text").asText()).isEqualTo("edits never shown to viewers");

        // viewers cannot list history or fetch arbitrary (even latest) release versions directly
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/releases")
                        .header("X-User-Id", viewer))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/releases/1")
                        .header("X-User-Id", viewer))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/releases/2")
                        .header("X-User-Id", viewer))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        // authoring roles still see the full history
        JsonNode all = json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/releases")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        assertThat(all.size()).isEqualTo(2);
        assertThat(all.get(0).get("version").intValue()).isEqualTo(2);
    }
}