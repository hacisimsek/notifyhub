package com.notifyhub.notification.delivery;

import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "false", matchIfMissing = true)
class DirectNotificationDeliveryDispatcher implements NotificationDeliveryDispatcher {

    private final NotificationSender notificationSender;

    DirectNotificationDeliveryDispatcher(NotificationSender notificationSender) {
        this.notificationSender = notificationSender;
    }

    @Override
    public NotificationLog dispatch(NotificationLog notificationLog) {
        NotificationSender.DeliveryResult result = notificationSender.send(notificationLog);
        if (result.sent()) {
            notificationLog.markSent();
        } else {
            notificationLog.markFailed(result.failureReason());
        }

        return notificationLog;
    }
}
