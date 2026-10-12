package com.notifyhub.gateway.proxy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.common.web.InternalServiceTokenFilter;
import com.notifyhub.common.web.RequestCorrelation;
import com.notifyhub.gateway.config.GatewayProperties;
import com.notifyhub.gateway.security.GatewayJwtVerifier;
import com.notifyhub.gateway.security.GatewayPrincipal;
import com.notifyhub.gateway.security.SessionCookies;
import com.notifyhub.gateway.security.TokenRevocationCheck;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.Locale;

@RestController
class GatewayProxyController {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final Logger LOGGER = LoggerFactory.getLogger(GatewayProxyController.class);

    private final GatewayProperties properties;
    private final GatewayJwtVerifier jwtVerifier;
    private final ProxyClient proxyClient;
    private final TokenRevocationCheck tokenRevocationCheck;
    private final SessionCookies sessionCookies;
    private final ObjectMapper objectMapper;

    GatewayProxyController(
            GatewayProperties properties,
            GatewayJwtVerifier jwtVerifier,
            ProxyClient proxyClient,
            TokenRevocationCheck tokenRevocationCheck,
            SessionCookies sessionCookies,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.jwtVerifier = jwtVerifier;
        this.proxyClient = proxyClient;
        this.tokenRevocationCheck = tokenRevocationCheck;
        this.sessionCookies = sessionCookies;
        this.objectMapper = objectMapper;
    }

    @RequestMapping(path = {"/api/auth/register", "/api/auth/login"}, method = RequestMethod.POST)
    ResponseEntity<byte[]> publicAuth(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        return withSessionCookie(forward(properties.services().authUrl(), request, body, HeaderMode.PUBLIC_AUTH));
    }

    @RequestMapping(path = "/api/auth/logout", method = RequestMethod.POST)
    ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookies.clear().toString())
                .build();
    }

    @RequestMapping(path = "/api/auth/me", method = RequestMethod.GET)
    ResponseEntity<byte[]> currentUser(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        Session session = authenticate(request);
        return forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE, session);
    }

    @RequestMapping(path = "/api/auth/password", method = RequestMethod.POST)
    ResponseEntity<byte[]> changePassword(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        Session session = authenticate(request);
        return withSessionCookie(forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE, session));
    }

    @RequestMapping(path = "/api/auth/profile", method = RequestMethod.PUT)
    ResponseEntity<byte[]> updateProfile(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        Session session = authenticate(request);
        return withSessionCookie(forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE, session));
    }

    @RequestMapping(path = "/api/reminders/**")
    ResponseEntity<byte[]> reminders(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        Session session = authenticate(request);
        return forward(properties.services().reminderUrl(), request, body, HeaderMode.INTERNAL_SERVICE, session);
    }

    @RequestMapping(path = "/api/notifications/**")
    ResponseEntity<byte[]> notifications(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        Session session = authenticate(request);
        return forward(properties.services().notificationUrl(), request, body, HeaderMode.INTERNAL_SERVICE, session);
    }

    private ResponseEntity<byte[]> forward(
            String baseUrl,
            HttpServletRequest request,
            byte[] body,
            HeaderMode headerMode
    ) {
        return forward(baseUrl, request, body, headerMode, null);
    }

    private ResponseEntity<byte[]> forward(
            String baseUrl,
            HttpServletRequest request,
            byte[] body,
            HeaderMode headerMode,
            Session session
    ) {
        ProxyRequest proxyRequest = new ProxyRequest(
                HttpMethod.valueOf(request.getMethod()),
                request.getRequestURI(),
                request.getQueryString(),
                extractHeaders(request, headerMode, session),
                body
        );
        ResponseEntity<byte[]> response = proxyClient.forward(targetUri(baseUrl, request), proxyRequest);
        if (session != null) {
            auditForwardedRequest(request, session.principal(), response.getStatusCode().value());
        }
        return response;
    }

    /**
     * API clients send a Bearer token; the dashboard sends the HttpOnly session cookie plus the client header.
     */
    private Session authenticate(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        String token = authorization != null && authorization.startsWith(BEARER_PREFIX)
                ? authorization.substring(BEARER_PREFIX.length())
                : sessionCookies.read(request)
                        .orElseThrow(() -> new UnauthorizedException("error.auth.invalidOrExpiredToken"));
        GatewayPrincipal principal = jwtVerifier.verify(token);
        if (tokenRevocationCheck.isRevoked(principal)) {
            throw new UnauthorizedException("error.auth.sessionRevoked");
        }
        return new Session(principal, token);
    }

    /**
     * Mirrors the access token from a successful auth response into the HttpOnly session cookie.
     */
    private ResponseEntity<byte[]> withSessionCookie(ResponseEntity<byte[]> response) {
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return response;
        }
        String cookie;
        try {
            JsonNode body = objectMapper.readTree(response.getBody());
            String token = body.path("accessToken").asText("");
            String expiresAt = body.path("expiresAt").asText("");
            if (token.isBlank() || expiresAt.isBlank()) {
                return response;
            }
            cookie = sessionCookies.issue(token, Instant.parse(expiresAt)).toString();
        } catch (IOException | DateTimeParseException ex) {
            return response;
        }
        HttpHeaders headers = new HttpHeaders();
        headers.addAll(response.getHeaders());
        headers.add(HttpHeaders.SET_COOKIE, cookie);
        return new ResponseEntity<>(response.getBody(), headers, response.getStatusCode());
    }

    private HttpHeaders extractHeaders(HttpServletRequest request, HeaderMode headerMode, Session session) {
        HttpHeaders headers = new HttpHeaders();
        Collections.list(request.getHeaderNames()).forEach(headerName ->
                Collections.list(request.getHeaders(headerName)).forEach(headerValue -> {
                    if (shouldForwardHeader(headerName, headerMode)) {
                        headers.add(headerName, headerValue);
                    }
                })
        );

        if (headerMode == HeaderMode.INTERNAL_SERVICE && session != null) {
            headers.set("X-User-Id", session.principal().userId().toString());
            headers.set("X-User-Email", session.principal().email());
            headers.set("X-User-Role", session.principal().role());
        }
        if (headerMode == HeaderMode.AUTH_SERVICE && session != null) {
            // Auth Service validates the JWT itself, so cookie sessions are forwarded as a Bearer token.
            headers.set(HttpHeaders.AUTHORIZATION, BEARER_PREFIX + session.token());
        }
        RequestCorrelation.currentRequestId()
                .ifPresent(requestId -> headers.set(RequestCorrelation.HEADER, requestId));
        if (properties.internalToken() != null && !properties.internalToken().isBlank()) {
            headers.set(InternalServiceTokenFilter.HEADER, properties.internalToken());
        }

        return headers;
    }

    private boolean shouldForwardHeader(String headerName, HeaderMode headerMode) {
        String normalized = headerName.toLowerCase(Locale.ROOT);
        if (normalized.equals("host")
                || normalized.equals("content-length")
                || normalized.equals("connection")
                || normalized.equals("transfer-encoding")
                || normalized.equals("x-request-id")
                || normalized.equals("x-internal-token")
                || normalized.equals("cookie")) {
            return false;
        }

        if (headerMode == HeaderMode.INTERNAL_SERVICE) {
            return !normalized.equals("authorization")
                    && !normalized.equals("x-user-id")
                    && !normalized.equals("x-user-email")
                    && !normalized.equals("x-user-role");
        }

        return true;
    }

    private URI targetUri(String baseUrl, HttpServletRequest request) {
        String normalizedBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(normalizedBase)
                .path(request.getRequestURI());
        if (request.getQueryString() != null) {
            builder.query(request.getQueryString());
        }
        return builder.build(true).toUri();
    }

    private void auditForwardedRequest(HttpServletRequest request, GatewayPrincipal principal, int statusCode) {
        String path = request.getRequestURI();
        String action = auditAction(request.getMethod(), path);
        AuditLogger.Builder audit = AuditLogger.event(LOGGER, action, "User %s called %s %s -> %d".formatted(
                        principal.email(),
                        request.getMethod(),
                        path,
                        statusCode
                ))
                .category("gateway")
                .outcome(statusCode >= 400 ? "failure" : "success")
                .user(principal.userId(), principal.email())
                .detail("role", principal.role())
                .detail("httpMethod", request.getMethod())
                .detail("path", path)
                .detail("statusCode", statusCode);

        String resourceType = resourceType(path);
        String resourceId = resourceId(path);
        if (resourceType != null || resourceId != null) {
            audit.resource(resourceType, resourceId);
        }
        audit.log();
    }

    private String auditAction(String method, String path) {
        if (path.equals("/api/auth/me") && method.equals("GET")) {
            return "auth.current_user.viewed";
        }
        if (path.equals("/api/auth/password") && method.equals("POST")) {
            return "auth.password.change.requested";
        }
        if (path.equals("/api/auth/profile") && method.equals("PUT")) {
            return "auth.profile.update.requested";
        }
        if (path.equals("/api/reminders") && method.equals("POST")) {
            return "reminder.create.requested";
        }
        if (path.equals("/api/reminders") && method.equals("GET")) {
            return "reminder.list.viewed";
        }
        if (path.startsWith("/api/reminders/") && method.equals("GET")) {
            return "reminder.view.requested";
        }
        if (path.startsWith("/api/reminders/") && method.equals("PUT")) {
            return "reminder.update.requested";
        }
        if (path.startsWith("/api/reminders/") && method.equals("DELETE")) {
            return "reminder.delete.requested";
        }
        if (path.equals("/api/notifications") && method.equals("GET")) {
            return "notification.history.viewed";
        }
        return "gateway.request.forwarded";
    }

    private String resourceType(String path) {
        if (path.startsWith("/api/reminders")) {
            return "reminder";
        }
        if (path.startsWith("/api/notifications")) {
            return "notification";
        }
        if (path.startsWith("/api/auth")) {
            return "user";
        }
        return null;
    }

    private String resourceId(String path) {
        if (!path.startsWith("/api/reminders/")) {
            return null;
        }
        String id = path.substring("/api/reminders/".length());
        return id.isBlank() ? null : id;
    }

    private record Session(GatewayPrincipal principal, String token) {
    }

    private enum HeaderMode {
        PUBLIC_AUTH,
        AUTH_SERVICE,
        INTERNAL_SERVICE
    }
}
