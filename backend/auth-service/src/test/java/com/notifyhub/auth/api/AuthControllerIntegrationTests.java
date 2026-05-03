package com.notifyhub.auth.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest
class AuthControllerIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void registerReturnsBearerTokenAndCurrentUser() throws Exception {
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "User@Example.com",
                                  "firstName": "Haci",
                                  "lastName": "Simsek",
                                  "phoneNumber": "+905551112233",
                                  "preferredLanguage": "tr",
                                  "password": "secret123"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tokenType", equalTo("Bearer")))
                .andExpect(jsonPath("$.accessToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.user.email", equalTo("user@example.com")))
                .andExpect(jsonPath("$.user.firstName", equalTo("Haci")))
                .andExpect(jsonPath("$.user.lastName", equalTo("Simsek")))
                .andExpect(jsonPath("$.user.phoneNumber", equalTo("+905551112233")))
                .andExpect(jsonPath("$.user.preferredLanguage", equalTo("tr")))
                .andExpect(jsonPath("$.user.role", equalTo("USER")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode body = objectMapper.readTree(response);
        String token = body.get("accessToken").asText();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", equalTo("user@example.com")))
                .andExpect(jsonPath("$.firstName", equalTo("Haci")))
                .andExpect(jsonPath("$.lastName", equalTo("Simsek")))
                .andExpect(jsonPath("$.phoneNumber", equalTo("+905551112233")))
                .andExpect(jsonPath("$.preferredLanguage", equalTo("tr")))
                .andExpect(jsonPath("$.role", equalTo("USER")));
    }

    @Test
    void loginRejectsWrongPassword() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "wrong-password@example.com",
                                  "firstName": "Wrong",
                                  "lastName": "Password",
                                  "phoneNumber": "+905551110000",
                                  "preferredLanguage": "en",
                                  "password": "secret123"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "wrong-password@example.com",
                                  "password": "badsecret"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void duplicateRegistrationReturnsConflict() throws Exception {
        String request = """
                {
                  "email": "duplicate@example.com",
                  "firstName": "Duplicate",
                  "lastName": "User",
                  "phoneNumber": "+905551110001",
                  "preferredLanguage": "en",
                  "password": "secret123"
                }
                """;

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isConflict());
    }

    @Test
    void currentUserRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordUpdatesCredentialAndIssuesBearerToken() throws Exception {
        String token = registerAndReturnToken("change-password@example.com", "secret123");

        String response = mockMvc.perform(post("/api/auth/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "secret123",
                                  "newPassword": "newSecret123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType", equalTo("Bearer")))
                .andExpect(jsonPath("$.accessToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.user.email", equalTo("change-password@example.com")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode body = objectMapper.readTree(response);
        String nextToken = body.get("accessToken").asText();
        assertThat(nextToken).isNotEqualTo(token);

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + nextToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", equalTo("change-password@example.com")));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "change-password@example.com",
                                  "password": "secret123"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "change-password@example.com",
                                  "password": "newSecret123"
                                }
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() throws Exception {
        String token = registerAndReturnToken("wrong-current-password@example.com", "secret123");

        mockMvc.perform(post("/api/auth/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "badsecret",
                                  "newPassword": "newSecret123"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordRequiresAuthentication() throws Exception {
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
    void updateProfilePersistsCurrentUserDetailsAndIssuesBearerToken() throws Exception {
        String token = registerAndReturnToken("profile-update@example.com", "secret123");

        String response = mockMvc.perform(put("/api/auth/profile")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Updated",
                                  "lastName": "User",
                                  "phoneNumber": "+905559998877",
                                  "preferredLanguage": "tr"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.user.firstName", equalTo("Updated")))
                .andExpect(jsonPath("$.user.lastName", equalTo("User")))
                .andExpect(jsonPath("$.user.phoneNumber", equalTo("+905559998877")))
                .andExpect(jsonPath("$.user.preferredLanguage", equalTo("tr")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String nextToken = objectMapper.readTree(response).get("accessToken").asText();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + nextToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName", equalTo("Updated")))
                .andExpect(jsonPath("$.lastName", equalTo("User")))
                .andExpect(jsonPath("$.phoneNumber", equalTo("+905559998877")))
                .andExpect(jsonPath("$.preferredLanguage", equalTo("tr")));
    }

    @Test
    void prometheusEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("# HELP")));
    }

    private String registerAndReturnToken(String email, String password) throws Exception {
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "firstName": "Test",
                                  "lastName": "User",
                                  "phoneNumber": "+905551112233",
                                  "preferredLanguage": "en",
                                  "password": "%s"
                                }
                                """.formatted(email, password)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(response).get("accessToken").asText();
    }
}
