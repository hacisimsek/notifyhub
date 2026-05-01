package com.notifyhub.reminder.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.messaging.kafka", name = "enabled", havingValue = "false", matchIfMissing = true)
class NoopReminderEventPublisher implements ReminderEventPublisher {

    @Override
    public void publish(ReminderTriggeredEvent event) {
        // Local/test mode keeps scheduling logic active without requiring a Kafka broker.
    }
}
