package com.notifyhub.reminder.service;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import com.notifyhub.reminder.messaging.ReminderEventPublisher;
import com.notifyhub.reminder.repository.ReminderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("test")
@SpringBootTest
class ReminderTriggerServiceIntegrationTests {

    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25b41");

    @Autowired
    private ReminderRepository reminderRepository;

    @Autowired
    private ReminderTriggerService reminderTriggerService;

    @Autowired
    private RecordingReminderEventPublisher eventPublisher;

    @BeforeEach
    void cleanDatabase() {
        reminderRepository.deleteAll();
        eventPublisher.clear();
    }

    @Test
    void dueRemindersAreMarkedTriggeredAndPublished() {
        Instant now = Instant.parse("2026-05-02T09:00:00Z");
        Reminder due = reminder(now.minusSeconds(30), NotificationChannel.EMAIL, "user@example.com");
        Reminder future = reminder(now.plusSeconds(3600), NotificationChannel.SMS, "+905551112233");
        reminderRepository.saveAll(List.of(due, future));

        int triggeredCount = reminderTriggerService.triggerDueReminders(now);

        assertThat(triggeredCount).isEqualTo(1);
        assertThat(eventPublisher.events()).singleElement().satisfies(event -> {
            assertThat(event.reminderId()).isEqualTo(due.getId());
            assertThat(event.userId()).isEqualTo(USER_ID);
            assertThat(event.channel()).isEqualTo(NotificationChannel.EMAIL);
            assertThat(event.recipient()).isEqualTo("user@example.com");
            assertThat(event.idempotencyKey()).isEqualTo("reminder:%s:%s".formatted(due.getId(), due.getScheduledFor()));
        });
        assertThat(reminderRepository.findById(due.getId()).orElseThrow().getStatus())
                .isEqualTo(ReminderStatus.TRIGGERED);
        assertThat(reminderRepository.findById(future.getId()).orElseThrow().getStatus())
                .isEqualTo(ReminderStatus.SCHEDULED);
    }

    @Test
    void triggeredRemindersAreNotPublishedAgain() {
        Instant now = Instant.parse("2026-05-02T09:00:00Z");
        Reminder due = reminder(now.minusSeconds(30), NotificationChannel.EMAIL, "user@example.com");
        reminderRepository.save(due);

        reminderTriggerService.triggerDueReminders(now);
        reminderTriggerService.triggerDueReminders(now.plusSeconds(60));

        assertThat(eventPublisher.events()).hasSize(1);
    }

    private Reminder reminder(Instant scheduledFor, NotificationChannel channel, String recipient) {
        return new Reminder(
                USER_ID,
                "Pay invoice",
                "Invoice is due tomorrow",
                scheduledFor,
                channel,
                recipient
        );
    }

    @TestConfiguration
    static class ReminderTriggerTestConfig {

        @Bean
        @Primary
        RecordingReminderEventPublisher recordingReminderEventPublisher() {
            return new RecordingReminderEventPublisher();
        }
    }

    static class RecordingReminderEventPublisher implements ReminderEventPublisher {

        private final List<ReminderTriggeredEvent> events = new ArrayList<>();

        @Override
        public void publish(ReminderTriggeredEvent event) {
            events.add(event);
        }

        List<ReminderTriggeredEvent> events() {
            return events;
        }

        void clear() {
            events.clear();
        }
    }
}
