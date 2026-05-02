package com.notifyhub.gateway.proxy;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest
class GatewayProxyControllerIntegrationTests {

    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25b31");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RecordingProxyClient proxyClient;

    @BeforeEach
    void resetProxyClient() {
        proxyClient.reset();
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
        assertThat(proxyClient.request.headers().getFirst(HttpHeaders.AUTHORIZATION)).isNull();
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

    private String validToken() throws Exception {
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
    }

    static class RecordingProxyClient implements ProxyClient {

        private URI targetUri;
        private ProxyRequest request;

        @Override
        public ResponseEntity<byte[]> forward(URI targetUri, ProxyRequest request) {
            this.targetUri = targetUri;
            this.request = request;
            return ResponseEntity.status(HttpStatus.OK)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("proxied".getBytes(StandardCharsets.UTF_8));
        }

        void reset() {
            targetUri = null;
            request = null;
        }
    }
}
