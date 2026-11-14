package com.notifyhub.notification.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Delivers EMAIL over SMTP and PUSH through ntfy, but only to allow-listed recipients.
 * Everything else, including load-test traffic, stays on the mock sender so an open demo cannot send real mail.
 */
@Primary
@Component
class LiveNotificationSender implements NotificationSender {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final MockNotificationSender mockSender;
    private final Set<String> liveRecipients;
    private final JavaMailSenderImpl mailSender;
    private final String mailFrom;
    private final String ntfyBaseUrl;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final ObjectMapper objectMapper;

    LiveNotificationSender(
            MockNotificationSender mockSender,
            ObjectMapper objectMapper,
            @Value("${notifyhub.delivery.live.recipients:}") List<String> liveRecipients,
            @Value("${notifyhub.delivery.live.smtp.host:}") String smtpHost,
            @Value("${notifyhub.delivery.live.smtp.port:587}") int smtpPort,
            @Value("${notifyhub.delivery.live.smtp.username:}") String smtpUsername,
            @Value("${notifyhub.delivery.live.smtp.password:}") String smtpPassword,
            @Value("${notifyhub.delivery.live.ntfy-base-url:https://ntfy.sh}") String ntfyBaseUrl
    ) {
        this.mockSender = mockSender;
        this.objectMapper = objectMapper;
        this.liveRecipients = liveRecipients.stream()
                .map(String::trim)
                .filter(recipient -> !recipient.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
        this.mailSender = smtpHost.isBlank() ? null : mailSender(smtpHost, smtpPort, smtpUsername, smtpPassword);
        this.mailFrom = smtpUsername;
        this.ntfyBaseUrl = ntfyBaseUrl.replaceAll("/+$", "");
    }

    @Override
    public DeliveryResult send(NotificationLog notificationLog) {
        if (!liveRecipients.contains(notificationLog.getRecipient().trim())) {
            return mockSender.send(notificationLog);
        }
        try {
            return switch (notificationLog.getChannel()) {
                case EMAIL -> sendEmail(notificationLog);
                case PUSH -> sendPush(notificationLog);
                case SMS -> mockSender.send(notificationLog);
            };
        } catch (Exception exception) {
            return DeliveryResult.failed("Live %s delivery failed: %s".formatted(
                    notificationLog.getChannel(), exception.getClass().getSimpleName()));
        }
    }

    private DeliveryResult sendEmail(NotificationLog notificationLog) {
        if (mailSender == null) {
            return DeliveryResult.failed("SMTP is not configured");
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(notificationLog.getRecipient().trim());
        message.setSubject(notificationLog.getSubject());
        message.setText(body(notificationLog));
        mailSender.send(message);
        return DeliveryResult.success();
    }

    private DeliveryResult sendPush(NotificationLog notificationLog) throws Exception {
        // JSON publishing keeps non-ASCII titles intact; ntfy headers would need RFC 2047 encoding.
        String payload = objectMapper.writeValueAsString(Map.of(
                "topic", notificationLog.getRecipient().trim(),
                "title", notificationLog.getSubject(),
                "message", body(notificationLog)));
        HttpRequest request = HttpRequest.newBuilder(URI.create(ntfyBaseUrl))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
        int status = httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        return status / 100 == 2 ? DeliveryResult.success() : DeliveryResult.failed("ntfy responded with HTTP " + status);
    }

    private static String body(NotificationLog notificationLog) {
        String message = notificationLog.getMessage();
        return message == null || message.isBlank() ? notificationLog.getSubject() : message;
    }

    private static JavaMailSenderImpl mailSender(String host, int port, String username, String password) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", "true");
        properties.put("mail.smtp.starttls.enable", "true");
        properties.put("mail.smtp.starttls.required", "true");
        properties.put("mail.smtp.connectiontimeout", "10000");
        properties.put("mail.smtp.timeout", "10000");
        properties.put("mail.smtp.writetimeout", "10000");
        return sender;
    }
}
