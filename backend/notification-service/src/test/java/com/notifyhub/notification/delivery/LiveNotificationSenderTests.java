package com.notifyhub.notification.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.domain.NotificationLog;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class LiveNotificationSenderTests {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpServer ntfy;

    @AfterEach
    void stopServer() {
        if (ntfy != null) {
            ntfy.stop(0);
        }
    }

    @Test
    void recipientsOutsideAllowListUseMockSender() {
        LiveNotificationSender sender = sender(List.of("me@example.com"), "http://127.0.0.1:1");

        assertThat(sender.send(log(NotificationChannel.EMAIL, "other@example.com")).sent()).isTrue();
        assertThat(sender.send(log(NotificationChannel.EMAIL, "other+fail@example.com")).sent()).isFalse();
    }

    @Test
    void allowListedEmailFailsClearlyWithoutSmtp() {
        LiveNotificationSender sender = sender(List.of("me@example.com"), "http://127.0.0.1:1");

        NotificationSender.DeliveryResult result = sender.send(log(NotificationChannel.EMAIL, " me@example.com "));

        assertThat(result.sent()).isFalse();
        assertThat(result.failureReason()).isEqualTo("SMTP is not configured");
    }

    @Test
    void allowListedPushPublishesJsonToNtfy() throws Exception {
        AtomicReference<String> received = new AtomicReference<>();
        ntfy = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ntfy.createContext("/", exchange -> {
            received.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        ntfy.start();
        LiveNotificationSender sender = sender(List.of("demo-topic"), "http://127.0.0.1:" + ntfy.getAddress().getPort() + "/");

        assertThat(sender.send(log(NotificationChannel.PUSH, "demo-topic")).sent()).isTrue();
        assertThat(objectMapper.readValue(received.get(), Map.class))
                .containsEntry("topic", "demo-topic")
                .containsEntry("title", "Toplantı")
                .containsEntry("message", "Body");
    }

    @Test
    void allowListedPushReportsUnreachableNtfyAsFailure() {
        LiveNotificationSender sender = sender(List.of("demo-topic"), "http://127.0.0.1:1");

        assertThat(sender.send(log(NotificationChannel.PUSH, "demo-topic")).sent()).isFalse();
    }

    private LiveNotificationSender sender(List<String> recipients, String ntfyBaseUrl) {
        return new LiveNotificationSender(new MockNotificationSender("+fail"), objectMapper, recipients,
                "", 587, "", "", ntfyBaseUrl);
    }

    private NotificationLog log(NotificationChannel channel, String recipient) {
        return new NotificationLog(UUID.randomUUID(), null, channel, recipient, "Toplantı", "Body", null);
    }
}
