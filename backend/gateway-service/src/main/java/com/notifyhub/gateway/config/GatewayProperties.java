package com.notifyhub.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "notifyhub.gateway")
public record GatewayProperties(
        Services services,
        Jwt jwt
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
    }
}
