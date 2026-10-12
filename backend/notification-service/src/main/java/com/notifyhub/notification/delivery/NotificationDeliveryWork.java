package com.notifyhub.notification.delivery;

import java.util.UUID;

// requestId keeps retries and DLQ entries correlated with the request that created the reminder.
public record NotificationDeliveryWork(UUID notificationId, int attempt, String requestId) {

    public static NotificationDeliveryWork firstAttempt(UUID notificationId, String requestId) {
        return new NotificationDeliveryWork(notificationId, 1, requestId);
    }

    public NotificationDeliveryWork nextAttempt() {
        return new NotificationDeliveryWork(notificationId, attempt + 1, requestId);
    }
}
