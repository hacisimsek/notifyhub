package com.notifyhub.reminder.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.messaging.kafka", name = "enabled", havingValue = "true")
class KafkaReminderEventPublisher implements ReminderEventPublisher {

    private final KafkaTemplate<String, ReminderTriggeredEvent> kafkaTemplate;
    private final String topic;

    KafkaReminderEventPublisher(
            KafkaTemplate<String, ReminderTriggeredEvent> kafkaTemplate,
            @Value("${notifyhub.messaging.topics.reminder-triggered}") String topic
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    @Override
    public void publish(ReminderTriggeredEvent event) {
        kafkaTemplate.send(topic, event.reminderId().toString(), event).join();
    }
}
