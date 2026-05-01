package com.notifyhub.notification.delivery;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "true")
class RabbitNotificationDeliveryListener {

    private final RabbitNotificationDeliveryWorker deliveryWorker;

    RabbitNotificationDeliveryListener(RabbitNotificationDeliveryWorker deliveryWorker) {
        this.deliveryWorker = deliveryWorker;
    }

    @RabbitListener(queues = "${notifyhub.delivery.rabbitmq.queue}")
    void onDelivery(NotificationDeliveryWork work) {
        deliveryWorker.deliver(work);
    }
}
