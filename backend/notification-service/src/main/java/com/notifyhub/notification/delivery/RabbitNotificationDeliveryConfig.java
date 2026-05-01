package com.notifyhub.notification.delivery;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@EnableRabbit
@Configuration
@EnableConfigurationProperties(NotificationRabbitProperties.class)
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "true")
class RabbitNotificationDeliveryConfig {

    @Bean
    DirectExchange notificationDeliveryExchange(NotificationRabbitProperties properties) {
        return new DirectExchange(properties.getExchange(), true, false);
    }

    @Bean
    DirectExchange notificationRetryExchange(NotificationRabbitProperties properties) {
        return new DirectExchange(properties.getRetryExchange(), true, false);
    }

    @Bean
    DirectExchange notificationDeadLetterExchange(NotificationRabbitProperties properties) {
        return new DirectExchange(properties.getDeadLetterExchange(), true, false);
    }

    @Bean
    Queue notificationDeliveryQueue(NotificationRabbitProperties properties) {
        return QueueBuilder.durable(properties.getQueue()).build();
    }

    @Bean
    Queue notificationRetryQueue(NotificationRabbitProperties properties) {
        return QueueBuilder.durable(properties.getRetryQueue())
                .withArgument("x-message-ttl", properties.getRetryDelayMs())
                .withArgument("x-dead-letter-exchange", properties.getExchange())
                .withArgument("x-dead-letter-routing-key", properties.getRoutingKey())
                .build();
    }

    @Bean
    Queue notificationDeadLetterQueue(NotificationRabbitProperties properties) {
        return QueueBuilder.durable(properties.getDeadLetterQueue()).build();
    }

    @Bean
    Binding notificationDeliveryBinding(
            Queue notificationDeliveryQueue,
            DirectExchange notificationDeliveryExchange,
            NotificationRabbitProperties properties
    ) {
        return BindingBuilder.bind(notificationDeliveryQueue)
                .to(notificationDeliveryExchange)
                .with(properties.getRoutingKey());
    }

    @Bean
    Binding notificationRetryBinding(
            Queue notificationRetryQueue,
            DirectExchange notificationRetryExchange,
            NotificationRabbitProperties properties
    ) {
        return BindingBuilder.bind(notificationRetryQueue)
                .to(notificationRetryExchange)
                .with(properties.getRetryRoutingKey());
    }

    @Bean
    Binding notificationDeadLetterBinding(
            Queue notificationDeadLetterQueue,
            DirectExchange notificationDeadLetterExchange,
            NotificationRabbitProperties properties
    ) {
        return BindingBuilder.bind(notificationDeadLetterQueue)
                .to(notificationDeadLetterExchange)
                .with(properties.getDeadLetterRoutingKey());
    }

    @Bean
    Jackson2JsonMessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
