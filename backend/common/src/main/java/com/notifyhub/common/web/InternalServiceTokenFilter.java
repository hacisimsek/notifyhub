package com.notifyhub.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Rejects calls that did not come through the gateway. Services trust the X-User-* headers, so without this check
 * anyone who can reach a service port could act as any user. Disabled when no token is configured (tests, gateway).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class InternalServiceTokenFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Internal-Token";

    private final byte[] expectedToken;

    public InternalServiceTokenFilter(@Value("${notifyhub.internal.service-token:}") String expectedToken) {
        this.expectedToken = expectedToken.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        boolean protectedPath = path.startsWith("/api/")
                || (path.startsWith("/internal/") && !path.equals("/internal/info"));
        return expectedToken.length == 0 || !protectedPath;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String token = request.getHeader(HEADER);
        if (token == null || !MessageDigest.isEqual(expectedToken, token.getBytes(StandardCharsets.UTF_8))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        filterChain.doFilter(request, response);
    }
}
