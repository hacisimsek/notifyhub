package com.notifyhub.notification.delivery;

import com.notifyhub.notification.domain.NotificationLog;

public interface NotificationSender {

    DeliveryResult send(NotificationLog notificationLog);

    record DeliveryResult(boolean sent, String failureReason) {
        static DeliveryResult success() {
            return new DeliveryResult(true, null);
        }

        static DeliveryResult failed(String failureReason) {
            return new DeliveryResult(false, failureReason);
        }
    }
}
