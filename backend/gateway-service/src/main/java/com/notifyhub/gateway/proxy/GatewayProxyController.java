package com.notifyhub.gateway.proxy;

import com.notifyhub.gateway.config.GatewayProperties;
import com.notifyhub.gateway.security.GatewayJwtVerifier;
import com.notifyhub.gateway.security.GatewayPrincipal;
import jakarta.servlet.http.HttpServletRequest;
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
        authenticate(request);
        return forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE);
    }

    @RequestMapping(path = "/api/auth/password", method = RequestMethod.POST)
    ResponseEntity<byte[]> changePassword(HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        authenticate(request);
        return forward(properties.services().authUrl(), request, body, HeaderMode.AUTH_SERVICE);
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
        return proxyClient.forward(targetUri(baseUrl, request), proxyRequest);
    }

    private GatewayPrincipal authenticate(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            throw new UnauthorizedException("Missing bearer token");
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

    private enum HeaderMode {
        PUBLIC_AUTH,
        AUTH_SERVICE,
        INTERNAL_SERVICE
    }
}
