package com.notifyhub.auth.security;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.auth.config.AuthProperties;
import com.notifyhub.auth.domain.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtTokenService {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final AuthProperties properties;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public JwtTokenService(AuthProperties properties, ObjectMapper objectMapper) {
        this(properties, objectMapper, Clock.systemUTC());
    }

    JwtTokenService(AuthProperties properties, ObjectMapper objectMapper, Clock clock) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public JwtToken create(AuthUser user) {
        Instant issuedAt = Instant.now(clock);
        Instant expiresAt = issuedAt.plus(properties.expiration());

        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "HS256");
        header.put("typ", "JWT");

        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", properties.issuer());
        claims.put("sub", user.getId().toString());
        claims.put("email", user.getEmail());
        claims.put("role", user.getRole().name());
        claims.put("iat", issuedAt.getEpochSecond());
        claims.put("exp", expiresAt.getEpochSecond());

        String unsignedToken = encode(header) + "." + encode(claims);
        return new JwtToken(unsignedToken + "." + sign(unsignedToken), expiresAt);
    }

    public AuthenticatedUser parse(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw unauthorized();
        }

        String unsignedToken = parts[0] + "." + parts[1];
        if (!constantTimeEquals(sign(unsignedToken), parts[2])) {
            throw unauthorized();
        }

        Map<String, Object> claims = decode(parts[1]);
        if (!properties.issuer().equals(claims.get("iss"))) {
            throw unauthorized();
        }

        Instant expiresAt = Instant.ofEpochSecond(asLong(claims.get("exp")));
        if (!expiresAt.isAfter(Instant.now(clock))) {
            throw unauthorized();
        }

        return new AuthenticatedUser(
                UUID.fromString((String) claims.get("sub")),
                (String) claims.get("email"),
                (String) claims.get("role")
        );
    }

    private String encode(Map<String, Object> value) {
        try {
            return ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize JWT payload", ex);
        }
    }

    private Map<String, Object> decode(String value) {
        try {
            return objectMapper.readValue(DECODER.decode(value), MAP_TYPE);
        } catch (Exception ex) {
            throw unauthorized();
        }
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(properties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return ENCODER.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not sign JWT", ex);
        }
    }

    private long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        throw unauthorized();
    }

    private boolean constantTimeEquals(String left, String right) {
        return MessageDigestSafe.equals(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
    }
}
