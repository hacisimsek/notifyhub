package com.notifyhub.reminder.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@ConditionalOnProperty(
        prefix = "notifyhub.reminders.trigger-scheduler",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
class ReminderTriggerScheduler {

    private final ReminderTriggerService reminderTriggerService;

    ReminderTriggerScheduler(ReminderTriggerService reminderTriggerService) {
        this.reminderTriggerService = reminderTriggerService;
    }

    @Scheduled(fixedDelayString = "${notifyhub.reminders.trigger-scheduler.fixed-delay-ms:60000}")
    void triggerDueReminders() {
        reminderTriggerService.triggerDueReminders(Instant.now());
    }
}
