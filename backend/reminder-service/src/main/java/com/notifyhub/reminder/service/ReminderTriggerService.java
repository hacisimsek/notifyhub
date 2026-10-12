package com.notifyhub.reminder.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.common.web.RequestCorrelation;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderOutboxEvent;
import com.notifyhub.reminder.domain.ReminderStatus;
import com.notifyhub.reminder.repository.ReminderOutboxEventRepository;
import com.notifyhub.reminder.repository.ReminderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class ReminderTriggerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ReminderTriggerService.class);

    private final ReminderRepository reminderRepository;
    private final ReminderOutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public ReminderTriggerService(
            ReminderRepository reminderRepository,
            ReminderOutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper
    ) {
        this.reminderRepository = reminderRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public int triggerDueReminders(Instant now) {
        var reminders = reminderRepository
                .findTop50ByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(ReminderStatus.SCHEDULED, now);

        reminders.forEach(reminder -> RequestCorrelation.runWith(reminder.getRequestId(), () -> {
            reminder.markTriggered();
            // Written in the same transaction as the status change; ReminderOutboxPublisher sends it to Kafka.
            ReminderTriggeredEvent event = toEvent(reminder, now);
            outboxEventRepository.save(new ReminderOutboxEvent(event.eventId(), reminder.getId(), toJson(event), now));
            AuditLogger.event(LOGGER, "reminder.triggered", "Reminder %s triggered for user %s".formatted(
                            reminder.getId(),
                            reminder.getOwnerId()
                    ))
                    .category("reminder")
                    .user(reminder.getOwnerId(), null)
                    .resource("reminder", reminder.getId())
                    .detail("channel", reminder.getChannel())
                    .recipient(reminder.getRecipient())
                    .detail("scheduledFor", reminder.getScheduledFor())
                    .detail("triggeredAt", now)
                    .log();
        }));

        return reminders.size();
    }

    private String toJson(ReminderTriggeredEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize reminder event " + event.eventId(), ex);
        }
    }

    private ReminderTriggeredEvent toEvent(Reminder reminder, Instant triggeredAt) {
        return new ReminderTriggeredEvent(
                UUID.randomUUID(),
                reminder.getId(),
                reminder.getOwnerId(),
                reminder.getChannel(),
                reminder.getRecipient(),
                reminder.getTitle(),
                reminder.getMessage(),
                reminder.getScheduledFor(),
                triggeredAt,
                "reminder:%s:%s".formatted(reminder.getId(), reminder.getScheduledFor()),
                RequestCorrelation.currentRequestId().orElse(null)
        );
    }
}
