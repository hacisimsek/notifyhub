package com.notifyhub.gateway.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Optional;

/**
 * Keeps the dashboard's access token in an HttpOnly cookie so page scripts never see it.
 */
@Component
public class SessionCookies {

    public static final String NAME = "NOTIFYHUB_SESSION";
    // Cross-site forms cannot set custom headers, so requiring one on cookie sessions blocks CSRF.
    public static final String CLIENT_HEADER = "X-NotifyHub-Client";

    private static final String PATH = "/api";

    private final boolean secure;

    public SessionCookies(@Value("${notifyhub.gateway.session-cookie.secure:false}") boolean secure) {
        this.secure = secure;
    }

    public ResponseCookie issue(String token, Instant expiresAt) {
        Duration maxAge = Duration.between(Instant.now(), expiresAt);
        return build(token, maxAge.isNegative() ? Duration.ZERO : maxAge);
    }

    public ResponseCookie clear() {
        return build("", Duration.ZERO);
    }

    public Optional<String> read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null || request.getHeader(CLIENT_HEADER) == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(cookie -> NAME.equals(cookie.getName()) && !cookie.getValue().isBlank())
                .map(Cookie::getValue)
                .findFirst();
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path(PATH)
                .maxAge(maxAge)
                .build();
    }
}
