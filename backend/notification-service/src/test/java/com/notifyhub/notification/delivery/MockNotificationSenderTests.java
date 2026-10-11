package com.notifyhub.notification.delivery;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.domain.NotificationLog;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MockNotificationSenderTests {

    @Test
    void recipientsWithFailureMarkerFail() {
        MockNotificationSender sender = new MockNotificationSender("+fail");

        assertThat(sender.send(log("demo+fail@example.com")).sent()).isFalse();
        assertThat(sender.send(log("demo@example.com")).sent()).isTrue();
    }

    @Test
    void blankMarkerDisablesSimulatedFailures() {
        MockNotificationSender sender = new MockNotificationSender("");

        assertThat(sender.send(log("demo+fail@example.com")).sent()).isTrue();
    }

    private NotificationLog log(String recipient) {
        return new NotificationLog(UUID.randomUUID(), null, NotificationChannel.EMAIL, recipient, "Subject", "Body", null);
    }
}
