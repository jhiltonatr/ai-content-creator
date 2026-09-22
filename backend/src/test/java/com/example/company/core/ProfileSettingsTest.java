package com.example.company.core;

import com.example.company.core.domain.SystemRole;
import com.example.company.core.user.UserRecord;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class ProfileSettingsTest extends ApiTestBase {

    @Test
    void userCanUpdateOwnProfile() throws Exception {
        UserRecord me = newUser("profile@example", "pw-123456", SystemRole.USER);

        var result = mvc.perform(MockMvcRequestBuilders.put("/api/me")
                        .header("X-User-Id", me.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"renamed@example\",\"displayName\":\"Renamed Person\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        JsonNode body = json(result);
        assertThat(body.get("email").asText()).isEqualTo("renamed@example");
        assertThat(body.get("displayName").asText()).isEqualTo("Renamed Person");

        var meResult = mvc.perform(MockMvcRequestBuilders.get("/api/me").header("X-User-Id", me.id()))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertThat(json(meResult).get("user").get("email").asText()).isEqualTo("renamed@example");
    }

    @Test
    void profileEmailConflictIsRejected() throws Exception {
        UserRecord me = newUser("profile-conflict@example", "pw-123456", SystemRole.USER);
        newUser("taken@example", "pw-123456", SystemRole.USER);

        mvc.perform(MockMvcRequestBuilders.put("/api/me")
                        .header("X-User-Id", me.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"taken@example\"}"))
                .andExpect(MockMvcResultMatchers.status().isConflict());
    }

    @Test
    void wrongCurrentPasswordIsRejected() throws Exception {
        UserRecord me = newUser("pw-wrong@example", "pw-123456", SystemRole.USER);

        mvc.perform(MockMvcRequestBuilders.post("/api/me/password")
                        .header("X-User-Id", me.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"nope\",\"newPassword\":\"new-password\"}"))
                .andExpect(MockMvcResultMatchers.status().isBadRequest());
    }

    @Test
    void changePasswordRevokesTokensAndAllowsRelogin() throws Exception {
        UserRecord me = newUser("pw-change@example", "old-pass-123", SystemRole.USER);
        String token = login("pw-change@example", "old-pass-123");

        mvc.perform(MockMvcRequestBuilders.post("/api/me/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"old-pass-123\",\"newPassword\":\"brand-new-456\"}"))
                .andExpect(MockMvcResultMatchers.status().isNoContent());

        mvc.perform(MockMvcRequestBuilders.get("/api/me").header("Authorization", "Bearer " + token))
                .andExpect(MockMvcResultMatchers.status().isUnauthorized());

        login("pw-change@example", "brand-new-456");
    }

    @Test
    void settingsDefaultsAndRoundTrip() throws Exception {
        UserRecord me = newUser("settings@example", "pw-123456", SystemRole.USER);

        var defaults = mvc.perform(MockMvcRequestBuilders.get("/api/me/settings").header("X-User-Id", me.id()))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        JsonNode def = json(defaults);
        assertThat(def.get("language").isNull()).isTrue();
        assertThat(def.get("theme").asText()).isEqualTo("DARK");

        mvc.perform(MockMvcRequestBuilders.put("/api/me/settings")
                        .header("X-User-Id", me.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"language\":\"fr\",\"theme\":\"LIGHT\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        var saved = mvc.perform(MockMvcRequestBuilders.get("/api/me/settings").header("X-User-Id", me.id()))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        JsonNode got = json(saved);
        assertThat(got.get("language").asText()).isEqualTo("fr");
        assertThat(got.get("theme").asText()).isEqualTo("LIGHT");

        // Partial update merges with the stored settings.
        mvc.perform(MockMvcRequestBuilders.put("/api/me/settings")
                        .header("X-User-Id", me.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"theme\":\"DARK\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        var merged = mvc.perform(MockMvcRequestBuilders.get("/api/me/settings").header("X-User-Id", me.id()))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        JsonNode after = json(merged);
        assertThat(after.get("language").asText()).isEqualTo("fr");
        assertThat(after.get("theme").asText()).isEqualTo("DARK");
    }
}