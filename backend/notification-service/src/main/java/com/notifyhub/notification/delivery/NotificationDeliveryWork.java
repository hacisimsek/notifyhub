package com.notifyhub.notification.delivery;

import java.util.UUID;

public record NotificationDeliveryWork(UUID notificationId, int attempt) {

    public static NotificationDeliveryWork firstAttempt(UUID notificationId) {
        return new NotificationDeliveryWork(notificationId, 1);
    }

    public NotificationDeliveryWork nextAttempt() {
        return new NotificationDeliveryWork(notificationId, attempt + 1);
    }
}
