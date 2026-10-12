package com.notifyhub.gateway.proxy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.gateway.security.GatewayPrincipal;
import com.notifyhub.gateway.security.TokenRevocationCheck;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest
class GatewayProxyControllerIntegrationTests {

    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25b31");
    private static final String REQUEST_ID = "request-test-123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RecordingProxyClient proxyClient;

    @Autowired
    private StubTokenRevocationCheck tokenRevocationCheck;

    @BeforeEach
    void resetProxyClient() {
        proxyClient.reset();
        tokenRevocationCheck.reset();
    }

    @Test
    void successfulLoginSetsHttpOnlySessionCookie() throws Exception {
        proxyClient.respondWithJson("""
                {"accessToken":"header.payload.signature","expiresAt":"%s"}
                """.formatted(Instant.now().plusSeconds(3600)));

        String setCookie = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@example.com\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);

        assertThat(setCookie)
                .startsWith("NOTIFYHUB_SESSION=header.payload.signature")
                .contains("HttpOnly", "SameSite=Strict", "Path=/api", "Max-Age=");
    }

    @Test
    void nonTokenAuthResponseDoesNotSetCookie() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    void cookieSessionWithClientHeaderReachesInternalServices() throws Exception {
        mockMvc.perform(get("/api/reminders")
                        .cookie(new Cookie("NOTIFYHUB_SESSION", validToken()))
                        .header("X-NotifyHub-Client", "dashboard"))
                .andExpect(status().isOk());

        assertThat(proxyClient.request.headers().getFirst("X-User-Id")).isEqualTo(USER_ID.toString());
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.COOKIE)).isNull();
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isNull();
    }

    @Test
    void cookieSessionWithoutClientHeaderIsRejected() throws Exception {
        mockMvc.perform(get("/api/reminders")
                        .cookie(new Cookie("NOTIFYHUB_SESSION", validToken())))
                .andExpect(status().isUnauthorized());

        assertThat(proxyClient.request).isNull();
    }

    @Test
    void cookieSessionIsForwardedToAuthServiceAsBearerToken() throws Exception {
        String token = validToken();
        mockMvc.perform(get("/api/auth/me")
                        .cookie(new Cookie("NOTIFYHUB_SESSION", token))
                        .header("X-NotifyHub-Client", "dashboard"))
                .andExpect(status().isOk());

        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer " + token);
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.COOKIE)).isNull();
    }

    @Test
    void logoutClearsSessionCookie() throws Exception {
        String setCookie = mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);

        assertThat(setCookie).startsWith("NOTIFYHUB_SESSION=").contains("Max-Age=0", "HttpOnly");
        assertThat(proxyClient.request).isNull();
    }

    @Test
    void revokedTokenIsRejectedWithSessionRevokedMessage() throws Exception {
        tokenRevocationCheck.revokeAll();

        mockMvc.perform(get("/api/reminders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + validToken(3)))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("error.auth.sessionRevoked")));

        assertThat(tokenRevocationCheck.lastPrincipal.tokenVersion()).isEqualTo(3);
        assertThat(proxyClient.request).isNull();
    }

    @Test
    void publicAuthRequestIsForwardedWithoutToken() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "user@example.com",
                                  "password": "secret123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(content().string("proxied"));

        assertThat(proxyClient.targetUri).hasToString("http://auth-service.test/api/auth/login");
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isNull();
        assertThat(proxyClient.request.headers().getFirst("X-Request-Id")).isNotBlank();
    }

    @Test
    void passwordChangeRequestRequiresBearerToken() throws Exception {
        mockMvc.perform(post("/api/auth/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "secret123",
                                  "newPassword": "newSecret123"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void passwordChangeRequestForwardsBearerTokenToAuthService() throws Exception {
        String token = validToken();

        mockMvc.perform(post("/api/auth/password")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "secret123",
                                  "newPassword": "newSecret123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(content().string("proxied"));

        assertThat(proxyClient.targetUri).hasToString("http://auth-service.test/api/auth/password");
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer " + token);
    }

    @Test
    void profileUpdateRequestForwardsBearerTokenToAuthService() throws Exception {
        String token = validToken();

        mockMvc.perform(put("/api/auth/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Haci",
                                  "lastName": "Simsek",
                                  "phoneNumber": "+905551112233",
                                  "preferredLanguage": "tr"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(content().string("proxied"));

        assertThat(proxyClient.targetUri).hasToString("http://auth-service.test/api/auth/profile");
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer " + token);
    }

    @Test
    void reminderRequestRequiresBearerToken() throws Exception {
        mockMvc.perform(get("/api/reminders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reminderRequestForwardsPrincipalHeaders() throws Exception {
        mockMvc.perform(get("/api/reminders?status=SCHEDULED&channel=EMAIL")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + validToken()))
                .andExpect(status().isOk())
                .andExpect(content().string("proxied"));

        assertThat(proxyClient.targetUri).hasToString(
                "http://reminder-service.test/api/reminders?status=SCHEDULED&channel=EMAIL"
        );
        assertThat(proxyClient.request.query()).isEqualTo("status=SCHEDULED&channel=EMAIL");
        assertThat(proxyClient.request.headers().getFirst("X-User-Id")).isEqualTo(USER_ID.toString());
        assertThat(proxyClient.request.headers().getFirst("X-User-Email")).isEqualTo("user@example.com");
        assertThat(proxyClient.request.headers().getFirst("X-User-Role")).isEqualTo("USER");
        assertThat(proxyClient.request.headers().getFirst("X-Request-Id")).isNotBlank();
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isNull();
        assertThat(proxyClient.request.headers().getFirst("X-Internal-Token")).isEqualTo("test-internal-token");
    }

    @Test
    void clientSuppliedInternalTokenIsReplaced() throws Exception {
        mockMvc.perform(get("/api/reminders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + validToken())
                        .header("X-Internal-Token", "spoofed"))
                .andExpect(status().isOk());

        assertThat(proxyClient.request.headers().get("X-Internal-Token")).containsExactly("test-internal-token");
    }

    @Test
    void incomingRequestIdIsPropagatedToDownstreamServices() throws Exception {
        mockMvc.perform(get("/api/reminders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + validToken())
                        .header("X-Request-Id", REQUEST_ID))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", REQUEST_ID))
                .andExpect(content().string("proxied"));

        assertThat(proxyClient.request.headers().getFirst("X-Request-Id")).isEqualTo(REQUEST_ID);
    }

    @Test
    void notificationHistoryForwardsQueryToNotificationService() throws Exception {
        mockMvc.perform(get("/api/notifications?status=SENT&channel=SMS")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + validToken()))
                .andExpect(status().isOk())
                .andExpect(content().string("proxied"));

        assertThat(proxyClient.targetUri).hasToString(
                "http://notification-service.test/api/notifications?status=SENT&channel=SMS"
        );
        assertThat(proxyClient.request.query()).isEqualTo("status=SENT&channel=SMS");
        assertThat(proxyClient.request.headers().getFirst("X-User-Id")).isEqualTo(USER_ID.toString());
    }

    @Test
    void tamperedBearerTokenIsRejected() throws Exception {
        mockMvc.perform(get("/api/reminders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + validToken() + "tampered"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void languageMessagesAreServedByGateway() throws Exception {
        mockMvc.perform(get("/api/i18n/messages?language=tr"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"language\":\"tr\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Giriş")));
    }

    private String validToken() throws Exception {
        return validToken(null);
    }

    private String validToken(Integer tokenVersion) throws Exception {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        ObjectMapper objectMapper = new ObjectMapper();

        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "HS256");
        header.put("typ", "JWT");

        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", "notifyhub-auth-test");
        claims.put("sub", USER_ID.toString());
        claims.put("email", "user@example.com");
        claims.put("role", "USER");
        if (tokenVersion != null) {
            claims.put("ver", tokenVersion);
        }
        claims.put("iat", Instant.now().getEpochSecond());
        claims.put("exp", Instant.now().plusSeconds(3600).getEpochSecond());

        String unsignedToken = encoder.encodeToString(objectMapper.writeValueAsBytes(header))
                + "."
                + encoder.encodeToString(objectMapper.writeValueAsBytes(claims));

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(
                "test-secret-with-enough-length-for-hmac-signing".getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
        ));
        return unsignedToken + "." + encoder.encodeToString(mac.doFinal(unsignedToken.getBytes(StandardCharsets.UTF_8)));
    }

    @TestConfiguration
    static class ProxyTestConfig {

        @Bean
        @Primary
        RecordingProxyClient recordingProxyClient() {
            return new RecordingProxyClient();
        }

        @Bean
        @Primary
        StubTokenRevocationCheck stubTokenRevocationCheck() {
            return new StubTokenRevocationCheck();
        }
    }

    static class RecordingProxyClient implements ProxyClient {

        private URI targetUri;
        private ProxyRequest request;
        private String jsonResponse;

        @Override
        public ResponseEntity<byte[]> forward(URI targetUri, ProxyRequest request) {
            this.targetUri = targetUri;
            this.request = request;
            if (jsonResponse != null) {
                return ResponseEntity.status(HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(jsonResponse.getBytes(StandardCharsets.UTF_8));
            }
            return ResponseEntity.status(HttpStatus.OK)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("proxied".getBytes(StandardCharsets.UTF_8));
        }

        void respondWithJson(String json) {
            jsonResponse = json;
        }

        void reset() {
            targetUri = null;
            request = null;
            jsonResponse = null;
        }
    }

    static class StubTokenRevocationCheck implements TokenRevocationCheck {

        private boolean revokeAll;
        private GatewayPrincipal lastPrincipal;

        @Override
        public boolean isRevoked(GatewayPrincipal principal) {
            lastPrincipal = principal;
            return revokeAll;
        }

        void revokeAll() {
            revokeAll = true;
        }

        void reset() {
            revokeAll = false;
            lastPrincipal = null;
        }
    }
}
