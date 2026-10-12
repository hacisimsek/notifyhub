package com.notifyhub.auth.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.auth.security.TokenVersionPublisher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest
class AuthTokenRevocationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RecordingTokenVersionPublisher publisher;

    @Test
    void passwordChangeRevokesEarlierTokensAndPublishesTheNewVersion() throws Exception {
        String oldToken = authToken(mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "revoked@example.com",
                                  "firstName": "Test",
                                  "lastName": "User",
                                  "phoneNumber": "+905551112233",
                                  "preferredLanguage": "en",
                                  "password": "secret123"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        String body = mockMvc.perform(post("/api/auth/password")
                        .header("Authorization", "Bearer " + oldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "secret123",
                                  "newPassword": "newSecret123"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String newToken = authToken(body);
        UUID userId = UUID.fromString(objectMapper.readTree(body).get("user").get("id").asText());

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", equalTo("error.auth.sessionRevoked")));
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk());
        assertThat(publisher.versions).containsEntry(userId, 1);
    }

    private String authToken(String responseBody) throws Exception {
        return objectMapper.readTree(responseBody).get("accessToken").asText();
    }

    @TestConfiguration
    static class RecordingPublisherConfig {

        @Bean
        @Primary
        RecordingTokenVersionPublisher recordingTokenVersionPublisher() {
            return new RecordingTokenVersionPublisher();
        }
    }

    static class RecordingTokenVersionPublisher implements TokenVersionPublisher {

        private final Map<UUID, Integer> versions = new ConcurrentHashMap<>();

        @Override
        public void publish(UUID userId, int tokenVersion) {
            versions.put(userId, tokenVersion);
        }
    }
}
