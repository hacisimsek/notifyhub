package com.notifyhub.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "notifyhub.auth.jwt")
public record AuthProperties(
        String issuer,
        String secret,
        Duration expiration
) {
}
