package com.notifyhub.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.charset.StandardCharsets;

@ConfigurationProperties(prefix = "notifyhub.gateway")
public record GatewayProperties(
        Services services,
        Jwt jwt,
        String internalToken
) {
    public record Services(
            String authUrl,
            String reminderUrl,
            String notificationUrl
    ) {
    }

    public record Jwt(
            String issuer,
            String secret
    ) {
        public Jwt {
            if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
                throw new IllegalStateException("AUTH_JWT_SECRET must be set to at least 32 bytes");
            }
        }
    }
}
