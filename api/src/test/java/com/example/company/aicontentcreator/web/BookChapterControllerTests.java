package com.example.company.aicontentcreator.web;

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
class BookChapterControllerTests {

    @Autowired
    private MockMvc mockMvc;

    private static final String STORY_JSON = """
            {
              "title": "The Silent Sea",
              "storyType": "NOVEL",
              "genre": "Fantasy",
              "language": "ENGLISH"
            }
            """;

    private static final String BOOK_JSON = """
            {
              "title": "Book One"
            }
            """;

    private static final String CHAPTER_JSON = """
            {
              "title": "Chapter One",
              "content": "It was a dark and stormy night."
            }
            """;

    @Test
    void createBookAssignsIdAndReturnsCreated() throws Exception {
        long storyId = createStory();

        mockMvc.perform(post("/api/stories/{storyId}/books", storyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BOOK_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.storyId").value(storyId))
                .andExpect(jsonPath("$.title").value("Book One"))
                .andExpect(jsonPath("$.chapters").isArray())
                .andExpect(jsonPath("$.chapters.length()").value(0));
    }

    @Test
    void listBooksReturnsAllBooksInOrder() throws Exception {
        long storyId = createStory();
        createBook(storyId, "Book One");
        createBook(storyId, "Book Two");

        mockMvc.perform(get("/api/stories/{storyId}/books", storyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("Book One"))
                .andExpect(jsonPath("$[1].title").value("Book Two"));
    }

    @Test
    void getBookReturnsBookWithChapters() throws Exception {
        long storyId = createStory();
        long bookId = createBook(storyId, "Book One");
        createChapter(storyId, bookId, "Chapter One");

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}", storyId, bookId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Book One"))
                .andExpect(jsonPath("$.chapters[0].title").value("Chapter One"));
    }

    @Test
    void updateBookChangesTitle() throws Exception {
        long storyId = createStory();
        long bookId = createBook(storyId, "Book One");

        mockMvc.perform(put("/api/stories/{storyId}/books/{bookId}", storyId, bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Book One Revised"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(bookId))
                .andExpect(jsonPath("$.title").value("Book One Revised"));
    }

    @Test
    void createBookUnderMissingStoryReturnsNotFound() throws Exception {
        mockMvc.perform(post("/api/stories/{storyId}/books", 999999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BOOK_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void getMissingBookReturnsNotFound() throws Exception {
        long storyId = createStory();

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}", storyId, 999999L))
                .andExpect(status().isNotFound());
    }

    @Test
    void createChapterAssignsIdAndReturnsCreated() throws Exception {
        long storyId = createStory();
        long bookId = createBook(storyId, "Book One");

        mockMvc.perform(post("/api/stories/{storyId}/books/{bookId}/chapters", storyId, bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CHAPTER_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.bookId").value(bookId))
                .andExpect(jsonPath("$.title").value("Chapter One"))
                .andExpect(jsonPath("$.content").value("It was a dark and stormy night."));
    }

    @Test
    void listChaptersReturnsAllChapters() throws Exception {
        long storyId = createStory();
        long bookId = createBook(storyId, "Book One");
        createChapter(storyId, bookId, "Chapter One");
        createChapter(storyId, bookId, "Chapter Two");

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}/chapters", storyId, bookId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("Chapter One"))
                .andExpect(jsonPath("$[1].title").value("Chapter Two"));
    }

    @Test
    void chapterRoundTripUpdateAndDelete() throws Exception {
        long storyId = createStory();
        long bookId = createBook(storyId, "Book One");
        long chapterId = createChapter(storyId, bookId, "Chapter One");

        mockMvc.perform(put("/api/stories/{storyId}/books/{bookId}/chapters/{chapterId}",
                        storyId, bookId, chapterId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Chapter One Revised",
                                  "content": "Edited text."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Chapter One Revised"))
                .andExpect(jsonPath("$.content").value("Edited text."));

        mockMvc.perform(delete("/api/stories/{storyId}/books/{bookId}/chapters/{chapterId}",
                        storyId, bookId, chapterId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}/chapters/{chapterId}",
                        storyId, bookId, chapterId))
                .andExpect(status().isNotFound());
    }

    @Test
    void createChapterUnderMissingBookReturnsNotFound() throws Exception {
        long storyId = createStory();

        mockMvc.perform(post("/api/stories/{storyId}/books/{bookId}/chapters", storyId, 999999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CHAPTER_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteBookCascadesChapters() throws Exception {
        long storyId = createStory();
        long bookId = createBook(storyId, "Book One");
        createChapter(storyId, bookId, "Chapter One");

        mockMvc.perform(delete("/api/stories/{storyId}/books/{bookId}", storyId, bookId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}", storyId, bookId))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}/chapters", storyId, bookId))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteStoryCascadesBooksAndChapters() throws Exception {
        long storyId = createStory();
        long bookId = createBook(storyId, "Book One");
        long chapterId = createChapter(storyId, bookId, "Chapter One");

        mockMvc.perform(delete("/api/stories/{storyId}", storyId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}/chapters/{chapterId}",
                        storyId, bookId, chapterId))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/stories/{storyId}/books/{bookId}", storyId, bookId))
                .andExpect(status().isNotFound());
    }

    @Test
    void createBookWithBlankTitleReturnsBadRequest() throws Exception {
        long storyId = createStory();

        mockMvc.perform(post("/api/stories/{storyId}/books", storyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "   "
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reorderBooksPersistsNewOrder() throws Exception {
        long storyId = createStory();
        long prequel = createBook(storyId, "Prequel");
        long bookOne = createBook(storyId, "Book One");

        mockMvc.perform(put("/api/stories/{storyId}/books/order", storyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bookIds": [%d, %d]
                                }
                                """.formatted(bookOne, prequel)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Book One"))
                .andExpect(jsonPath("$[1].title").value("Prequel"));

        mockMvc.perform(get("/api/stories/{storyId}/books", storyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Book One"))
                .andExpect(jsonPath("$[1].title").value("Prequel"));
    }

    @Test
    void reorderMustBePermutationOfStoriesBooks() throws Exception {
        long storyId = createStory();
        long bookOne = createBook(storyId, "Book One");
        createBook(storyId, "Book Two");

        mockMvc.perform(put("/api/stories/{storyId}/books/order", storyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bookIds": [%d]
                                }
                                """.formatted(bookOne)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/stories/{storyId}/books", storyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Book One"))
                .andExpect(jsonPath("$[1].title").value("Book Two"));
    }

    @Test
    void reorderUnderMissingStoryReturnsNotFound() throws Exception {
        mockMvc.perform(put("/api/stories/{storyId}/books/order", 999999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "bookIds": []
                                }
                                """))
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

    private long createBook(long storyId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/stories/{storyId}/books", storyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "%s"
                                }
                                """.formatted(title)))
                .andExpect(status().isCreated())
                .andReturn();
        return extractId(result.getResponse().getContentAsString());
    }

    private long createChapter(long storyId, long bookId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/stories/{storyId}/books/{bookId}/chapters", storyId, bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "%s",
                                  "content": "Chapter text."
                                }
                                """.formatted(title)))
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