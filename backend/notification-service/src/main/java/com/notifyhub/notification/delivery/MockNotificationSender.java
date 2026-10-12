package com.notifyhub.notification.delivery;

import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
class MockNotificationSender implements NotificationSender {

    private final String failureMarker;

    // Recipients containing the marker (e.g. demo+fail@example.com) fail, which exercises retry and DLQ paths.
    MockNotificationSender(@Value("${notifyhub.delivery.mock.failure-marker:+fail}") String failureMarker) {
        this.failureMarker = failureMarker.toLowerCase(Locale.ROOT);
    }

    @Override
    public DeliveryResult send(NotificationLog notificationLog) {
        if (!failureMarker.isBlank() && notificationLog.getRecipient().toLowerCase(Locale.ROOT).contains(failureMarker)) {
            return DeliveryResult.failed("Simulated provider failure for recipient marker '%s'".formatted(failureMarker));
        }
        return DeliveryResult.success();
    }
}
