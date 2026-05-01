package com.notifyhub.reminder.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@ConditionalOnProperty(
        prefix = "notifyhub.reminders.trigger-scheduler",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
class ReminderSchedulingConfig {
}
