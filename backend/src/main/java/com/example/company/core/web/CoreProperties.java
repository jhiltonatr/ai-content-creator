package com.example.company.core.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Configuration
@ConfigurationProperties(prefix = "app")
@Validated
public class CoreProperties {

    private long demoUserId = 1L;

    public long demoUserId() {
        return demoUserId;
    }

    public void setDemoUserId(long demoUserId) {
        this.demoUserId = demoUserId;
    }
}