package com.notifyhub.notification.delivery;

import com.notifyhub.notification.repository.NotificationDeliveryAttemptRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class NotificationDeliveryAttemptRecorderTests {

    @Test
    void registersEveryChannelAndResultAtZero() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();

        new NotificationDeliveryAttemptRecorder(mock(NotificationDeliveryAttemptRepository.class), registry);

        assertThat(registry.find("notifyhub.notification.delivery.attempts").counters()).hasSize(9);
        assertThat(registry.get("notifyhub.notification.delivery.attempts").tags("channel", "SMS", "status", "FAILED")
                .counter().count()).isZero();
        assertThat(registry.get("notifyhub.notification.delivery.attempts").tags("channel", "PUSH", "status", "SENT")
                .counter().count()).isZero();
    }
}
