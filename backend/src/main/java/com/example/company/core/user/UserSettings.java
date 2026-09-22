package com.example.company.core.user;

/**
 * Personal preferences for a user account, persisted as JSONB in {@code users.settings}.
 * New preferences are added as new fields on this record.
 */
public record UserSettings(String language, Theme theme) {

    public enum Theme { LIGHT, DARK }

    /**
     * None set yet: default language is inherited from the story, and the app's native look
     * is dark.
     */
    public static UserSettings empty() {
        return new UserSettings(null, Theme.DARK);
    }
}