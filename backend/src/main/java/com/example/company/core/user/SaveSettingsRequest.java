package com.example.company.core.user;

public record SaveSettingsRequest(
        String language,
        UserSettings.Theme theme) {
}