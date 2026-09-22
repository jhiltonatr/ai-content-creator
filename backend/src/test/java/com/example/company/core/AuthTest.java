package com.example.company.core;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

import tools.jackson.databind.JsonNode;

@Transactional
class AuthTest extends ApiTestBase {

    @Test
    void loginIssueTokenAndMeReturnsSystemRole() throws Exception {
        newUser("writer@auth.example", "s3cret-pass", null);

        MvcResult login = mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"writer@auth.example\",\"password\":\"s3cret-pass\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        String token = json(login).get("token").asText();
        assertThat(token).isNotBlank();
        assertThat(json(login).get("user").get("systemRole").asText()).isEqualTo("USER");

        JsonNode me = json(mvc.perform(MockMvcRequestBuilders.get("/api/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        assertThat(me.get("user").get("email").asText()).isEqualTo("writer@auth.example");
    }

    @Test
    void wrongPasswordAndUnknownEmailAre401() throws Exception {
        newUser("person@auth.example", "right-password", null);

        mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"person@auth.example\",\"password\":\"wrong-pass\"}"))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());

        mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody@auth.example\",\"password\":\"whatever42\"}"))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());
    }

    @Test
    void logoutInvalidatesTheToken() throws Exception {
        newUser("leaver@auth.example", "some-pass", null);
        String token = login("leaver@auth.example", "some-pass");

        mvc.perform(MockMvcRequestBuilders.post("/api/auth/logout")
                        .header("Authorization", "Bearer " + token))
                .andExpect(MockMvcResultMatchers.status().isNoContent());

        mvc.perform(MockMvcRequestBuilders.get("/api/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());
    }

    @Test
    void disabledAccountCannotLogin() throws Exception {
        newUser("gone@auth.example", "some-pass", null);
        long id = newUser("gone2@auth.example", "some-pass", null).id();
        users.setEnabled(id, false);

        mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"gone2@auth.example\",\"password\":\"some-pass\"}"))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
    }

    @Test
    void passwordlessUsersCannotLoginYet() throws Exception {
        newUser("unset@auth.example");
        mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"unset@auth.example\",\"password\":\"whatever42\"}"))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());
    }
}