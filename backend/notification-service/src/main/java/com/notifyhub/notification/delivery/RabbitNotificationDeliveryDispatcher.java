package com.notifyhub.notification.delivery;

import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "true")
class RabbitNotificationDeliveryDispatcher implements NotificationDeliveryDispatcher {

    private final RabbitNotificationDeliveryPublisher publisher;

    RabbitNotificationDeliveryDispatcher(RabbitNotificationDeliveryPublisher publisher) {
        this.publisher = publisher;
    }

    @Override
    public NotificationLog dispatch(NotificationLog notificationLog) {
        publisher.publishDelivery(NotificationDeliveryWork.firstAttempt(notificationLog.getId()));
        return notificationLog;
    }
}
