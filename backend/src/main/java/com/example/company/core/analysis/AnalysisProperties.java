package com.example.company.core.analysis;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

@Configuration
@ConfigurationProperties(prefix = "storyforge.analysis")
@Validated
public class AnalysisProperties {

    private String baseUrl = "http://localhost:8081";
    private String model = "llama3.1";
    private int timeoutMs = 180_000;
    private int maxParagraphs = 30;
    private int maxParagraphChars = 2000;

    public String baseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String model() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public int timeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(int timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public int maxParagraphs() {
        return maxParagraphs;
    }

    public void setMaxParagraphs(int maxParagraphs) {
        this.maxParagraphs = maxParagraphs;
    }

    public int maxParagraphChars() {
        return maxParagraphChars;
    }

    public void setMaxParagraphChars(int maxParagraphChars) {
        this.maxParagraphChars = maxParagraphChars;
    }
}
