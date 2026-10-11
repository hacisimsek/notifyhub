package com.notifyhub.notification.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.common.web.RequestCorrelation;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

class KafkaReminderTriggeredEventListenerTests {

    @Test
    void handlesEventUnderTheRequestIdThatCreatedTheReminder() {
        ReminderTriggeredEventHandler handler = mock(ReminderTriggeredEventHandler.class);
        AtomicReference<String> seen = new AtomicReference<>();
        doAnswer(invocation -> {
            seen.set(RequestCorrelation.currentRequestId().orElse(null));
            return null;
        }).when(handler).handle(any());

        new KafkaReminderTriggeredEventListener(handler).onReminderTriggered(new ReminderTriggeredEvent(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), NotificationChannel.SMS, "+905551112233",
                "Pay invoice", null, Instant.now(), Instant.now(), "reminder:1", "req-create-9"
        ));

        assertThat(seen.get()).isEqualTo("req-create-9");
        assertThat(RequestCorrelation.currentRequestId()).isEmpty();
    }
}
