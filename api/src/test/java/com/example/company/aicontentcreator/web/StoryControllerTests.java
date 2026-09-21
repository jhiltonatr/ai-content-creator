package com.example.company.aicontentcreator.web;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class StoryControllerTests {

    @Autowired
    private MockMvc mockMvc;

    private static final String STORY_JSON = """
            {
              "title": "The Silent Sea",
              "storyType": "NOVEL",
              "genre": "Fantasy",
              "language": "ENGLISH",
              "description": "A story about the sea.",
              "tags": ["fantasy", "adventure"]
            }
            """;

    @Test
    void createStoryAssignsIdAndReturnsCreated() throws Exception {
        mockMvc.perform(post("/api/stories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(STORY_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("The Silent Sea"))
                .andExpect(jsonPath("$.storyType").value("NOVEL"))
                .andExpect(jsonPath("$.genre").value("Fantasy"))
                .andExpect(jsonPath("$.language").value("ENGLISH"))
                .andExpect(jsonPath("$.description").value("A story about the sea."))
                .andExpect(jsonPath("$.tags[0]").value("fantasy"))
                .andExpect(jsonPath("$.createdAt").exists());
    }

    @Test
    void listStoriesReturnsCreatedStories() throws Exception {
        mockMvc.perform(post("/api/stories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(STORY_JSON))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/stories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[*].title").value(hasItem("The Silent Sea")));
    }

    @Test
    void getStoryReturnsStory() throws Exception {
        long id = createStory();

        mockMvc.perform(get("/api/stories/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.title").value("The Silent Sea"));
    }

    @Test
    void getMissingStoryReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/stories/{id}", 999999L))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateStoryReturnsUpdatedStory() throws Exception {
        long id = createStory();

        mockMvc.perform(put("/api/stories/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "The Silent Sea II",
                                  "storyType": "NOVEL",
                                  "genre": "Mystery",
                                  "language": "JAPANESE",
                                  "description": "Updated.",
                                  "tags": ["mystery"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.title").value("The Silent Sea II"))
                .andExpect(jsonPath("$.genre").value("Mystery"))
                .andExpect(jsonPath("$.language").value("JAPANESE"));
    }

    @Test
    void updateMissingStoryReturnsNotFound() throws Exception {
        mockMvc.perform(put("/api/stories/{id}", 999999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(STORY_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteStoryDeletesIt() throws Exception {
        long id = createStory();

        mockMvc.perform(delete("/api/stories/{id}", id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/stories/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteMissingStoryReturnsNotFound() throws Exception {
        mockMvc.perform(delete("/api/stories/{id}", 999999L))
                .andExpect(status().isNotFound());
    }

    private long createStory() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/stories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(STORY_JSON))
                .andExpect(status().isCreated())
                .andReturn();
        return extractId(result.getResponse().getContentAsString());
    }

    private static long extractId(String json) {
        String marker = "\"id\":";
        int start = json.indexOf(marker) + marker.length();
        int end = json.indexOf(',', start);
        return Long.parseLong(json.substring(start, end).trim());
    }
}