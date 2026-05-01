package com.notifyhub.reminder.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.reminder.repository.ReminderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest
class ReminderControllerIntegrationTests {

    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25a11");
    private static final UUID OTHER_USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25a12");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ReminderRepository reminderRepository;

    @BeforeEach
    void cleanDatabase() {
        reminderRepository.deleteAll();
    }

    @Test
    void createAndListReminderForOwner() throws Exception {
        String scheduledFor = Instant.now().plus(2, ChronoUnit.DAYS).toString();

        mockMvc.perform(post("/api/reminders")
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Pay invoice",
                                  "message": "Invoice is due tomorrow",
                                  "scheduledFor": "%s",
                                  "channel": "EMAIL",
                                  "recipient": "User@Example.com"
                                }
                                """.formatted(scheduledFor)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownerId", equalTo(USER_ID.toString())))
                .andExpect(jsonPath("$.title", equalTo("Pay invoice")))
                .andExpect(jsonPath("$.status", equalTo("SCHEDULED")))
                .andExpect(jsonPath("$.channel", equalTo("EMAIL")))
                .andExpect(jsonPath("$.recipient", equalTo("User@Example.com")));

        mockMvc.perform(get("/api/reminders")
                        .header("X-User-Id", USER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title", equalTo("Pay invoice")));
    }

    @Test
    void updateReminderOwnedByUser() throws Exception {
        String id = createReminder(USER_ID, "Initial reminder");
        String scheduledFor = Instant.now().plus(3, ChronoUnit.DAYS).toString();

        mockMvc.perform(put("/api/reminders/{id}", id)
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Updated reminder",
                                  "message": "Updated message",
                                  "scheduledFor": "%s",
                                  "channel": "SMS",
                                  "recipient": "+905551112233"
                                }
                                """.formatted(scheduledFor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", equalTo("Updated reminder")))
                .andExpect(jsonPath("$.message", equalTo("Updated message")))
                .andExpect(jsonPath("$.channel", equalTo("SMS")))
                .andExpect(jsonPath("$.recipient", equalTo("+905551112233")));
    }

    @Test
    void ownerCannotReadAnotherUsersReminder() throws Exception {
        String id = createReminder(USER_ID, "Private reminder");

        mockMvc.perform(get("/api/reminders/{id}", id)
                        .header("X-User-Id", OTHER_USER_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteReminderOwnedByUser() throws Exception {
        String id = createReminder(USER_ID, "Delete reminder");

        mockMvc.perform(delete("/api/reminders/{id}", id)
                        .header("X-User-Id", USER_ID))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/reminders/{id}", id)
                        .header("X-User-Id", USER_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsPastScheduledTime() throws Exception {
        String scheduledFor = Instant.now().minus(1, ChronoUnit.DAYS).toString();

        mockMvc.perform(post("/api/reminders")
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Past reminder",
                                  "message": "This should fail",
                                  "scheduledFor": "%s",
                                  "channel": "EMAIL",
                                  "recipient": "user@example.com"
                                }
                                """.formatted(scheduledFor)))
                .andExpect(status().isBadRequest());
    }

    private String createReminder(UUID userId, String title) throws Exception {
        String scheduledFor = Instant.now().plus(2, ChronoUnit.DAYS).toString();
        String response = mockMvc.perform(post("/api/reminders")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "%s",
                                  "message": "Message",
                                  "scheduledFor": "%s",
                                  "channel": "EMAIL",
                                  "recipient": "user@example.com"
                                }
                                """.formatted(title, scheduledFor)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode body = objectMapper.readTree(response);
        return body.get("id").asText();
    }
}
