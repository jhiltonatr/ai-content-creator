package com.example.company.core.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Configuration
@ConfigurationProperties(prefix = "app")
@Validated
public class CoreProperties {

    /**
     * When {@code true}, requests may impersonate any user via the {@code X-User-Id} header
     * instead of a bearer token. Intended for tests and local demos only; keep it off in real
     * deployments.
     */
    private boolean trustXUserId = false;

    /** Bearer-token session length after login. */
    private long tokenTtlHours = 168;

    public boolean trustXUserId() {
        return trustXUserId;
    }

    public void setTrustXUserId(boolean trustXUserId) {
        this.trustXUserId = trustXUserId;
    }

    public Duration tokenTtl() {
        return Duration.ofHours(tokenTtlHours);
    }

    public void setTokenTtlHours(long tokenTtlHours) {
        this.tokenTtlHours = tokenTtlHours;
    }
}