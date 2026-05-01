package com.notifyhub.notification.delivery;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "true")
class RabbitNotificationDeliveryPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final NotificationRabbitProperties properties;

    RabbitNotificationDeliveryPublisher(RabbitTemplate rabbitTemplate, NotificationRabbitProperties properties) {
        this.rabbitTemplate = rabbitTemplate;
        this.properties = properties;
    }

    void publishDelivery(NotificationDeliveryWork work) {
        publishAfterCommit(() -> rabbitTemplate.convertAndSend(
                properties.getExchange(),
                properties.getRoutingKey(),
                work
        ));
    }

    void publishRetry(NotificationDeliveryWork work) {
        publishAfterCommit(() -> rabbitTemplate.convertAndSend(
                properties.getRetryExchange(),
                properties.getRetryRoutingKey(),
                work
        ));
    }

    void publishDeadLetter(NotificationDeliveryWork work) {
        publishAfterCommit(() -> rabbitTemplate.convertAndSend(
                properties.getDeadLetterExchange(),
                properties.getDeadLetterRoutingKey(),
                work
        ));
    }

    private void publishAfterCommit(Runnable publish) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            publish.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                publish.run();
            }
        });
    }
}
