package com.notifyhub.reminder.service;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import com.notifyhub.reminder.messaging.ReminderEventPublisher;
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
    private final ReminderEventPublisher eventPublisher;

    public ReminderTriggerService(ReminderRepository reminderRepository, ReminderEventPublisher eventPublisher) {
        this.reminderRepository = reminderRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public int triggerDueReminders(Instant now) {
        var reminders = reminderRepository
                .findTop50ByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(ReminderStatus.SCHEDULED, now);

        reminders.forEach(reminder -> {
            reminder.markTriggered();
            eventPublisher.publish(toEvent(reminder, now));
            AuditLogger.event(LOGGER, "reminder.triggered", "Reminder %s triggered for user %s".formatted(
                            reminder.getId(),
                            reminder.getOwnerId()
                    ))
                    .category("reminder")
                    .user(reminder.getOwnerId(), null)
                    .resource("reminder", reminder.getId())
                    .detail("channel", reminder.getChannel())
                    .detail("recipient", reminder.getRecipient())
                    .detail("scheduledFor", reminder.getScheduledFor())
                    .detail("triggeredAt", now)
                    .log();
        });

        return reminders.size();
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
                "reminder:%s:%s".formatted(reminder.getId(), reminder.getScheduledFor())
        );
    }
}
