package com.notifyhub.notification.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.messaging.kafka", name = "enabled", havingValue = "true")
class KafkaReminderTriggeredEventListener {

    private final ReminderTriggeredEventHandler eventHandler;

    KafkaReminderTriggeredEventListener(ReminderTriggeredEventHandler eventHandler) {
        this.eventHandler = eventHandler;
    }

    @KafkaListener(
            topics = "${notifyhub.messaging.topics.reminder-triggered}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    void onReminderTriggered(ReminderTriggeredEvent event) {
        eventHandler.handle(event);
    }
}
