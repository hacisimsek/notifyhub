package com.notifyhub.gateway.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.gateway.config.GatewayProperties;
import com.notifyhub.gateway.proxy.UnauthorizedException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Component
public class GatewayJwtVerifier {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final GatewayProperties properties;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public GatewayJwtVerifier(GatewayProperties properties, ObjectMapper objectMapper) {
        this(properties, objectMapper, Clock.systemUTC());
    }

    GatewayJwtVerifier(GatewayProperties properties, ObjectMapper objectMapper, Clock clock) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public GatewayPrincipal verify(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new UnauthorizedException("error.auth.invalidOrExpiredToken");
        }

        String unsignedToken = parts[0] + "." + parts[1];
        if (!MessageDigest.isEqual(sign(unsignedToken).getBytes(StandardCharsets.UTF_8),
                parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw new UnauthorizedException("error.auth.invalidOrExpiredToken");
        }

        Map<String, Object> claims = decode(parts[1]);
        if (!properties.jwt().issuer().equals(claims.get("iss"))) {
            throw new UnauthorizedException("error.auth.invalidOrExpiredToken");
        }

        Instant expiresAt = Instant.ofEpochSecond(asLong(claims.get("exp")));
        if (!expiresAt.isAfter(Instant.now(clock))) {
            throw new UnauthorizedException("error.auth.invalidOrExpiredToken");
        }

        return new GatewayPrincipal(
                UUID.fromString((String) claims.get("sub")),
                (String) claims.get("email"),
                (String) claims.get("role")
        );
    }

    private Map<String, Object> decode(String value) {
        try {
            return objectMapper.readValue(DECODER.decode(value), MAP_TYPE);
        } catch (Exception ex) {
            throw new UnauthorizedException("error.auth.invalidOrExpiredToken");
        }
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(properties.jwt().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return ENCODER.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not verify JWT", ex);
        }
    }

    private long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        throw new UnauthorizedException("error.auth.invalidOrExpiredToken");
    }
}
