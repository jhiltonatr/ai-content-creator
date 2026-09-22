package com.example.company.core;

import com.example.company.core.user.UserRepository;
import com.example.company.core.user.UserRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
abstract class ApiTestBase {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected UserRepository users;

    @Autowired
    protected JsonMapper mapper;

    protected UserRecord newUser(String email) {
        return users.create(email, email.split("@")[0]);
    }

    protected long createStory(long userId, String title, String storyType) throws Exception {
        MvcResult result = mvc.perform(MockMvcRequestBuilders.post("/api/stories")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"storyType\":\"" + storyType + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(result).get("id").longValue();
    }

    protected JsonNode json(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    protected MvcResult analyze(long storyId, long nodeId, long userId) throws Exception {
        return analyze(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/nodes/" + nodeId + "/analyze")
                .header("X-User-Id", userId));
    }

    protected MvcResult analyze(MockHttpServletRequestBuilder request) throws Exception {
        MvcResult pending = mvc.perform(request)
                .andExpect(MockMvcResultMatchers.request().asyncStarted())
                .andReturn();
        return mvc.perform(MockMvcRequestBuilders.asyncDispatch(pending)).andReturn();
    }
}