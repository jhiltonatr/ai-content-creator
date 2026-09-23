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
class NodeNotesTest extends ApiTestBase {

    private long newChapter(long userId, long storyId, String title) throws Exception {
        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/nodes")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"" + title + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(created).get("id").longValue();
    }

    private MvcResult putNotes(long userId, long storyId, long nodeId, long version, String changeId, String note)
            throws Exception {
        return mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + storyId + "/nodes/" + nodeId + "/notes")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + version + ",\"changeId\":\"" + changeId + "\",\"note\":"
                                + (note == null ? "null" : "\"" + note + "\"") + "}"))
                .andReturn();
    }

    @Test
    void notesRoundTripPreserveMetaAndVersion() throws Exception {
        long alice = newUser("notes-a@test.example").id();
        long story = createStory(alice, "Notes", "NOVEL");
        long chapter = newChapter(alice, story, "One");

        // starts empty
        JsonNode empty = json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes/" + chapter + "/notes")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        assertThat(empty.get("note").isNull()).isTrue();

        MvcResult saved = putNotes(alice, story, chapter, 1, "n1", "What do I want to write here?");
        JsonNode savedBody = json(saved);
        assertThat(savedBody.get("version").longValue()).isEqualTo(2);
        assertThat(savedBody.get("meta").get("notes").asText()).isEqualTo("What do I want to write here?");

        JsonNode read = json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes/" + chapter + "/notes")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        assertThat(read.get("note").asText()).isEqualTo("What do I want to write here?");

        // a blank note removes the slot and still bumps the version (concurrency protocol)
        MvcResult cleared = putNotes(alice, story, chapter, 2, "n2", "");
        JsonNode clearedBody = json(cleared);
        assertThat(clearedBody.get("version").longValue()).isEqualTo(3);
        assertThat(clearedBody.get("meta").has("notes")).isFalse();
        JsonNode clearedRead = json(mvc.perform(MockMvcRequestBuilders.get(
                        "/api/stories/" + story + "/nodes/" + chapter + "/notes")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        assertThat(clearedRead.get("note").isNull()).isTrue();
    }

    @Test
    void notesReplayIsIdempotentAndStaleWritesConflict() throws Exception {
        long alice = newUser("notes-b@test.example").id();
        long story = createStory(alice, "Notes2", "NOVEL");
        long chapter = newChapter(alice, story, "Two");

        putNotes(alice, story, chapter, 1, "replay", "draft one");

        // replaying the same changeId is a no-op (no version bump)
        MvcResult replay = putNotes(alice, story, chapter, 2, "replay", "changed before replay");
        assertThat(json(replay).get("version").longValue()).isEqualTo(2);

        // stale expectedVersion → 409 carrying the current node
        MvcResult stale = putNotes(alice, story, chapter, 1, "other", "stale");
        assertThat(stale.getResponse().getStatus()).isEqualTo(409);
        JsonNode conflict = json(stale);
        assertThat(conflict.get("error").get("code").asText()).isEqualTo("CONFLICT");
        assertThat(conflict.get("current").get("version").longValue()).isEqualTo(2);
    }

    @Test
    void notesFollowThePermissionMatrix() throws Exception {
        long alice = newUser("notes-c@test.example").id();
        long bob = newUser("notes-editor@test.example").id();
        long carol = newUser("notes-viewer@test.example").id();
        long story = createStory(alice, "Notes3", "NOVEL");
        long chapter = newChapter(alice, story, "Three");

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"notes-editor@test.example\",\"role\":\"EDITOR\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"notes-viewer@test.example\",\"role\":\"VIEWER\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        // editor may read drafts (notes included) but not write them
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes/" + chapter + "/notes")
                        .header("X-User-Id", bob))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + chapter + "/notes")
                        .header("X-User-Id", bob)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"changeId\":\"x\",\"note\":\"nope\"}"))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        // viewer: notes are draft content — never readable
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes/" + chapter + "/notes")
                        .header("X-User-Id", carol))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
    }

    @Test
    void declaredDoneReleaseStripsPrivateNotesFromMeta() throws Exception {
        long alice = newUser("notes-d@test.example").id();
        long story = createStory(alice, "Notes4", "NOVEL");
        long chapter = newChapter(alice, story, "Published");

        putNotes(alice, story, chapter, 1, "n", "secret plans for this chapter");
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + chapter)
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":2,\"changeId\":\"done\",\"status\":\"DONE\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        MvcResult released = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/releases")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"v1\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();

        JsonNode node = json(released).get("nodes").get(0);
        assertThat(node.get("meta").has("notes")).isFalse();
        // the note still exists in the working set for the writing team
        assertThat(json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes/" + chapter + "/notes")
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn()).get("note").asText()).isEqualTo("secret plans for this chapter");
    }
}
