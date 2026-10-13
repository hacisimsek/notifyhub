package com.notifyhub.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.charset.StandardCharsets;
import java.util.List;

@ConfigurationProperties(prefix = "notifyhub.gateway")
public record GatewayProperties(
        Services services,
        Jwt jwt,
        String internalToken,
        Cors cors
) {
    public GatewayProperties {
        if (cors == null) {
            cors = new Cors(List.of());
        }
    }

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

    /**
     * Browser origins allowed to call the Gateway directly. The dashboard reaches it through its own
     * nginx proxy, which strips the Origin header, so it does not need to be listed here.
     */
    public record Cors(
            List<String> allowedOrigins
    ) {
        public Cors {
            allowedOrigins = allowedOrigins == null
                    ? List.of()
                    : allowedOrigins.stream().map(String::trim).filter(origin -> !origin.isEmpty()).toList();
        }
    }
}
