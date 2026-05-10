package com.notifyhub.gateway.proxy;

import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.gateway.config.GatewayProperties;
import com.notifyhub.gateway.security.GatewayJwtVerifier;
import com.notifyhub.gateway.security.GatewayPrincipal;
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

import java.net.URI;
import java.util.Collections;
import java.util.Locale;

@RestController
class GatewayProxyController {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final Logger LOGGER = LoggerFactory.getLogger(GatewayProxyController.class);

    private final GatewayProperties properties;
    private final GatewayJwtVerifier jwtVerifier;
    private final ProxyClient proxyClient;

    GatewayProxyController(GatewayProperties properties, GatewayJwtVerifier jwtVerifier, ProxyClient proxyClient) {
        this.properties = properties;
        this.jwtVerifier = jwtVerifier;
        this.proxyClient = proxyClient;
    }

    @RequestMapping(path = {"/api/auth/register", "/api/auth/login"}, method = RequestMethod.POST)
    ResponseEntity<byte[]> publicAuth(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        return forward(properties.services().authUrl(), request, body, HeaderMode.PUBLIC_AUTH);
    }

    @RequestMapping(path = "/api/auth/me", method = RequestMethod.GET)
    ResponseEntity<byte[]> currentUser(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        GatewayPrincipal principal = authenticate(request);
        return forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE, principal);
    }

    @RequestMapping(path = "/api/auth/password", method = RequestMethod.POST)
    ResponseEntity<byte[]> changePassword(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        GatewayPrincipal principal = authenticate(request);
        return forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE, principal);
    }

    @RequestMapping(path = "/api/auth/profile", method = RequestMethod.PUT)
    ResponseEntity<byte[]> updateProfile(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        GatewayPrincipal principal = authenticate(request);
        return forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE, principal);
    }

    @RequestMapping(path = "/api/reminders/**")
    ResponseEntity<byte[]> reminders(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        GatewayPrincipal principal = authenticate(request);
        return forward(properties.services().reminderUrl(), request, body, HeaderMode.INTERNAL_SERVICE, principal);
    }

    @RequestMapping(path = "/api/notifications/**")
    ResponseEntity<byte[]> notifications(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        GatewayPrincipal principal = authenticate(request);
        return forward(properties.services().notificationUrl(), request, body, HeaderMode.INTERNAL_SERVICE, principal);
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
            GatewayPrincipal principal
    ) {
        ProxyRequest proxyRequest = new ProxyRequest(
                HttpMethod.valueOf(request.getMethod()),
                request.getRequestURI(),
                request.getQueryString(),
                extractHeaders(request, headerMode, principal),
                body
        );
        ResponseEntity<byte[]> response = proxyClient.forward(targetUri(baseUrl, request), proxyRequest);
        if (principal != null) {
            auditForwardedRequest(request, principal, response.getStatusCode().value());
        }
        return response;
    }

    private GatewayPrincipal authenticate(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            throw new UnauthorizedException("error.auth.invalidOrExpiredToken");
        }
        return jwtVerifier.verify(authorization.substring(BEARER_PREFIX.length()));
    }

    private HttpHeaders extractHeaders(HttpServletRequest request, HeaderMode headerMode, GatewayPrincipal principal) {
        HttpHeaders headers = new HttpHeaders();
        Collections.list(request.getHeaderNames()).forEach(headerName ->
                Collections.list(request.getHeaders(headerName)).forEach(headerValue -> {
                    if (shouldForwardHeader(headerName, headerMode)) {
                        headers.add(headerName, headerValue);
                    }
                })
        );

        if (headerMode == HeaderMode.INTERNAL_SERVICE && principal != null) {
            headers.set("X-User-Id", principal.userId().toString());
            headers.set("X-User-Email", principal.email());
            headers.set("X-User-Role", principal.role());
        }

        return headers;
    }

    private boolean shouldForwardHeader(String headerName, HeaderMode headerMode) {
        String normalized = headerName.toLowerCase(Locale.ROOT);
        if (normalized.equals("host")
                || normalized.equals("content-length")
                || normalized.equals("connection")
                || normalized.equals("transfer-encoding")) {
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

    private enum HeaderMode {
        PUBLIC_AUTH,
        AUTH_SERVICE,
        INTERNAL_SERVICE
    }
}
