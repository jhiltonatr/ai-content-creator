package com.example.company.core;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs with {@code app.trust-x-user-id=false} (the production default) so the header
 * cannot be used to impersonate anyone.
 */
@SpringBootTest(properties = "app.trust-x-user-id=false")
@AutoConfigureMockMvc
class AuthSecurityTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JsonMapper mapper;

    @Test
    void anonymousRequestsAreRejected() throws Exception {
        mvc.perform(MockMvcRequestBuilders.get("/api/me"))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());

        // X-User-Id is ignored when trust is off
        mvc.perform(MockMvcRequestBuilders.get("/api/me")
                        .header("X-User-Id", 1))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());

        mvc.perform(MockMvcRequestBuilders.get("/api/me")
                        .header("Authorization", "Bearer not-a-real-token"))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());
    }

    @Test
    void seededAdminCanLoginAndReadMe() throws Exception {
        var loginResult = mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"password\":\"storyforge\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        String token = mapper.readTree(loginResult.getResponse().getContentAsString()).get("token").asText();

        var meResult = mvc.perform(MockMvcRequestBuilders.get("/api/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertThat(mapper.readTree(meResult.getResponse().getContentAsString())
                .get("user").get("systemRole").asText()).isEqualTo("ADMIN");
    }

    @Test
    void apiEndpointsRequireAuthentication() throws Exception {
        mvc.perform(MockMvcRequestBuilders.get("/api/stories"))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());
    }
}