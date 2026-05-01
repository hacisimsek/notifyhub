package com.notifyhub.notification.delivery;

import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.stereotype.Component;

@Component
class MockNotificationSender implements NotificationSender {

    @Override
    public DeliveryResult send(NotificationLog notificationLog) {
        return DeliveryResult.success();
    }
}
