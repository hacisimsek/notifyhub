package com.notifyhub.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

@ConfigurationProperties(prefix = "notifyhub.auth.jwt")
public record AuthProperties(
        String issuer,
        String secret,
        Duration expiration
) {
    public AuthProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("AUTH_JWT_SECRET must be set to at least 32 bytes");
        }
    }
}
