package com.notifyhub.notification.delivery;

import com.notifyhub.common.web.RequestCorrelation;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

class RabbitNotificationDeliveryListenerTests {

    @Test
    void deliversWorkUnderItsRequestId() {
        RabbitNotificationDeliveryWorker worker = mock(RabbitNotificationDeliveryWorker.class);
        AtomicReference<String> seen = new AtomicReference<>();
        doAnswer(invocation -> {
            seen.set(RequestCorrelation.currentRequestId().orElse(null));
            return null;
        }).when(worker).deliver(any());

        new RabbitNotificationDeliveryListener(worker)
                .onDelivery(new NotificationDeliveryWork(UUID.randomUUID(), 2, "req-create-9"));

        assertThat(seen.get()).isEqualTo("req-create-9");
        assertThat(RequestCorrelation.currentRequestId()).isEmpty();
    }
}
