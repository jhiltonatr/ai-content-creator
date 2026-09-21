package com.example.company.core;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class TenancyTest extends ApiTestBase {

    @Test
    void permissionMatrixAndReleaseGating() throws Exception {
        long alice = newUser("a@test.example").id();
        long bob = newUser("b@test.example").id();
        long carol = newUser("c@test.example").id();
        long dave = newUser("d@test.example").id();

        long story = createStory(alice, "Gated", "NOVEL");

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"b@test.example\",\"role\":\"COLLABORATOR\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"c@test.example\",\"role\":\"EDITOR\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"d@test.example\",\"role\":\"VIEWER\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        // viewer: cannot read drafts or write
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", dave))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
        // viewer: no release exists yet, so the story card is hidden from the list
        assertThat(json(mvc.perform(MockMvcRequestBuilders.get("/api/stories")
                        .header("X-User-Id", dave))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn()).findParents("id"))
                .noneMatch(n -> n.get("id").longValue() == story);
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", dave)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"No\"}"))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        // editor: can read drafts but cannot write
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", carol))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", carol)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"No\"}"))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        // collaborator: can write
        MvcResult done = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", bob)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Done chapter\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long doneId = json(done).get("id").longValue();

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", bob)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"Still cooking\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated());

        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + doneId)
                        .header("X-User-Id", bob)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"status\":\"DONE\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        // only owner may publish
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/releases")
                        .header("X-User-Id", bob)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"from collab\"}"))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        MvcResult released = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/releases")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"First\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        int version = json(released).get("version").intValue();

        // snapshot contains only the DONE node
        assertThat(json(released).get("nodes").size()).isEqualTo(1);
        assertThat(json(released).get("nodes").get(0).get("title").asText()).isEqualTo("Done chapter");

        // viewer: once a release exists the card appears again, still only for published content
        assertThat(json(mvc.perform(MockMvcRequestBuilders.get("/api/stories")
                        .header("X-User-Id", dave))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn()).findParents("id"))
                .anyMatch(n -> n.get("id").longValue() == story
                        && "VIEWER".equals(n.get("myRole").asString()));

        // viewer may read the release snapshot but never the working tree
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/releases/" + version)
                        .header("X-User-Id", dave))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes")
                        .header("X-User-Id", dave))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        // last owner cannot be removed
        mvc.perform(MockMvcRequestBuilders.delete("/api/stories/" + story + "/members/" + alice)
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isBadRequest());
    }
}