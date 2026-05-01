package com.notifyhub.notification.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("test")
@SpringBootTest
class ReminderTriggeredEventHandlerIntegrationTests {

    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25b51");
    private static final UUID REMINDER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25b52");

    @Autowired
    private ReminderTriggeredEventHandler eventHandler;

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    @BeforeEach
    void cleanDatabase() {
        notificationLogRepository.deleteAll();
    }

    @Test
    void reminderEventCreatesNotificationLog() {
        var response = eventHandler.handle(event("reminder-idempotency-1"));

        assertThat(response.userId()).isEqualTo(USER_ID);
        assertThat(response.reminderId()).isEqualTo(REMINDER_ID);
        assertThat(response.channel()).isEqualTo(NotificationChannel.EMAIL);
        assertThat(response.recipient()).isEqualTo("user@example.com");
        assertThat(response.status().name()).isEqualTo("SENT");
        assertThat(notificationLogRepository.findByUserIdOrderByCreatedAtDesc(USER_ID)).hasSize(1);
    }

    @Test
    void reminderEventIsIdempotentByKey() {
        eventHandler.handle(event("reminder-idempotency-2"));
        eventHandler.handle(event("reminder-idempotency-2"));

        assertThat(notificationLogRepository.findByUserIdOrderByCreatedAtDesc(USER_ID)).hasSize(1);
    }

    private ReminderTriggeredEvent event(String idempotencyKey) {
        return new ReminderTriggeredEvent(
                UUID.randomUUID(),
                REMINDER_ID,
                USER_ID,
                NotificationChannel.EMAIL,
                "User@Example.com",
                "Invoice due",
                "Invoice is due tomorrow",
                Instant.parse("2026-05-02T09:00:00Z"),
                Instant.parse("2026-05-02T09:00:05Z"),
                idempotencyKey
        );
    }
}
