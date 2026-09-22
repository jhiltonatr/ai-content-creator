package com.example.company.core;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class AdminUserTest extends ApiTestBase {

    private static final String ADMIN_PASSWORD = "admin-secret-42";

    private long testAdmin() {
        return newUser("root@admin.example", ADMIN_PASSWORD,
                com.example.company.core.domain.SystemRole.ADMIN).id();
    }

    @Test
    void nonAdminIsForbidden() throws Exception {
        long actor = testAdmin();
        long regular = newUser("regular@admin.example", "regular-pass-42", null).id();

        mvc.perform(MockMvcRequestBuilders.get("/api/admin/users")
                        .header("X-User-Id", regular))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        // the real admin can list
        mvc.perform(MockMvcRequestBuilders.get("/api/admin/users")
                        .header("X-User-Id", actor))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    @Test
    void adminCanCreateUpdateResetAndDisableUsers() throws Exception {
        long actor = testAdmin();

        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/admin/users")
                        .header("X-User-Id", actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"new@admin.example\",\"displayName\":\"New Person\","
                                + "\"password\":\"first-password\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        long newId = json(created).get("id").longValue();
        assertThat(json(created).get("systemRole").asText()).isEqualTo("USER");
        assertThat(json(created).get("enabled").asBoolean()).isTrue();

        // duplicate email is a conflict
        mvc.perform(MockMvcRequestBuilders.post("/api/admin/users")
                        .header("X-User-Id", actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"new@admin.example\",\"displayName\":\"Dup\",\"password\":\"first-password\"}"))
                .andExpect(MockMvcResultMatchers.status().isConflict());

        // new user logs in with the admin-chosen password
        login("new@admin.example", "first-password");

        // admin can change identity and role
        mvc.perform(MockMvcRequestBuilders.put("/api/admin/users/" + newId)
                        .header("X-User-Id", actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Renamed\",\"systemRole\":\"ADMIN\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.jsonPath("$.displayName").value("Renamed"))
                .andExpect(MockMvcResultMatchers.jsonPath("$.systemRole").value("ADMIN"));

        // resetting the password invalidates existing sessions
        String token = login("new@admin.example", "first-password");
        mvc.perform(MockMvcRequestBuilders.post("/api/admin/users/" + newId + "/password")
                        .header("X-User-Id", actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"brand-new-password\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.get("/api/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());
        login("new@admin.example", "brand-new-password");

        // disabling blocks login and listing reflects it
        mvc.perform(MockMvcRequestBuilders.put("/api/admin/users/" + newId)
                        .header("X-User-Id", actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"new@admin.example\",\"password\":\"brand-new-password\"}"))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
    }

    @Test
    void adminCannotDemoteOrDisableThemselves() throws Exception {
        long actor = testAdmin();

        mvc.perform(MockMvcRequestBuilders.put("/api/admin/users/" + actor)
                        .header("X-User-Id", actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"systemRole\":\"USER\"}"))
                .andExpect(MockMvcResultMatchers.status().isBadRequest());

        mvc.perform(MockMvcRequestBuilders.put("/api/admin/users/" + actor)
                        .header("X-User-Id", actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(MockMvcResultMatchers.status().isBadRequest());
    }

    @Test
    void adminCannotDeleteSelfOrLastAdmin() throws Exception {
        long actor = testAdmin();

        mvc.perform(MockMvcRequestBuilders.delete("/api/admin/users/" + actor)
                        .header("X-User-Id", actor))
                .andExpect(MockMvcResultMatchers.status().isBadRequest());

        // two admins: deleting either is allowed
        long peer = newUser("peer@admin.example", "peer-secret-42",
                com.example.company.core.domain.SystemRole.ADMIN).id();
        mvc.perform(MockMvcRequestBuilders.delete("/api/admin/users/" + peer)
                        .header("X-User-Id", actor))
                .andExpect(MockMvcResultMatchers.status().isNoContent());

        // deleting a user that owns stories is refused
        long author = newUser("author@admin.example", "author-secret-42", null).id();
        createStory(author, "Kept", "NOVEL");
        mvc.perform(MockMvcRequestBuilders.delete("/api/admin/users/" + author)
                        .header("X-User-Id", actor))
                .andExpect(MockMvcResultMatchers.status().isConflict());
    }

    @Test
    void adminCanDeleteAUserWithoutStories() throws Exception {
        long actor = testAdmin();
        long prey = newUser("prey@admin.example", "prey-secret-42", null).id();

        mvc.perform(MockMvcRequestBuilders.delete("/api/admin/users/" + prey)
                        .header("X-User-Id", actor))
                .andExpect(MockMvcResultMatchers.status().isNoContent());

        mvc.perform(MockMvcRequestBuilders.get("/api/me")
                        .header("X-User-Id", prey))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());
    }
}