package com.notifyhub.notification.api;

import com.notifyhub.notification.repository.NotificationDeliveryAttemptRepository;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest
class NotificationControllerIntegrationTests {

    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25a21");
    private static final UUID OTHER_USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25a22");
    private static final UUID REMINDER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25a23");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NotificationDeliveryAttemptRepository notificationDeliveryAttemptRepository;

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    @BeforeEach
    void cleanDatabase() {
        notificationDeliveryAttemptRepository.deleteAll();
        notificationLogRepository.deleteAll();
    }

    @Test
    void createNotificationDispatchesWithMockSender() throws Exception {
        mockMvc.perform(post("/internal/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(notificationRequest("invoice-due-1")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId", equalTo(USER_ID.toString())))
                .andExpect(jsonPath("$.reminderId", equalTo(REMINDER_ID.toString())))
                .andExpect(jsonPath("$.channel", equalTo("EMAIL")))
                .andExpect(jsonPath("$.recipient", equalTo("user@example.com")))
                .andExpect(jsonPath("$.status", equalTo("SENT")))
                .andExpect(jsonPath("$.attemptCount", equalTo(1)))
                .andExpect(jsonPath("$.lastAttemptAt", notNullValue()))
                .andExpect(jsonPath("$.sentAt", notNullValue()));

        var notification = notificationLogRepository.findByUserIdOrderByCreatedAtDesc(USER_ID).getFirst();
        var attempts = notificationDeliveryAttemptRepository
                .findByNotificationLogIdOrderByAttemptedAtAsc(notification.getId());
        assertThat(attempts).hasSize(1);
        assertThat(attempts.getFirst().getAttemptNumber()).isEqualTo(1);
        assertThat(attempts.getFirst().getStatus().name()).isEqualTo("SENT");
    }

    @Test
    void listNotificationsOnlyReturnsCurrentUserHistory() throws Exception {
        mockMvc.perform(post("/internal/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(notificationRequest("invoice-due-2")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/internal/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(notificationRequestForUser(OTHER_USER_ID, "invoice-due-other")))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/notifications")
                        .header("X-User-Id", USER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId", equalTo(USER_ID.toString())))
                .andExpect(jsonPath("$[0].attemptCount", equalTo(1)))
                .andExpect(jsonPath("$[0].lastAttemptAt", notNullValue()));
    }

    @Test
    void idempotencyKeyReturnsExistingNotification() throws Exception {
        String idempotencyKey = "invoice-due-idempotent";

        mockMvc.perform(post("/internal/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(notificationRequest(idempotencyKey)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/internal/notifications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(notificationRequest(idempotencyKey)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/notifications")
                        .header("X-User-Id", USER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].idempotencyKey", equalTo(idempotencyKey)))
                .andExpect(jsonPath("$[0].attemptCount", equalTo(1)));
    }

    private String notificationRequest(String idempotencyKey) {
        return notificationRequestForUser(USER_ID, idempotencyKey);
    }

    private String notificationRequestForUser(UUID userId, String idempotencyKey) {
        return """
                {
                  "userId": "%s",
                  "reminderId": "%s",
                  "channel": "EMAIL",
                  "recipient": "User@Example.com",
                  "subject": "Invoice due",
                  "message": "Invoice is due tomorrow",
                  "idempotencyKey": "%s"
                }
                """.formatted(userId, REMINDER_ID, idempotencyKey);
    }
}
