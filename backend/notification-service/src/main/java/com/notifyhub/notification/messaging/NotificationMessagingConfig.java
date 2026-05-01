package com.notifyhub.notification.messaging;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;

@Configuration
@EnableKafka
@ConditionalOnProperty(prefix = "notifyhub.messaging.kafka", name = "enabled", havingValue = "true")
class NotificationMessagingConfig {
}
