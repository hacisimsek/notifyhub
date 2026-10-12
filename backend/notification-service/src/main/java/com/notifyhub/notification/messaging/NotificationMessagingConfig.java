package com.notifyhub.notification.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.DelegatingByTypeSerializer;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.Map;

@Configuration
@EnableKafka
@ConditionalOnProperty(prefix = "notifyhub.messaging.kafka", name = "enabled", havingValue = "true")
class NotificationMessagingConfig {

    static final String DEAD_LETTER_SUFFIX = ".DLT";

    @Bean
    NewTopic reminderTriggeredDeadLetterTopic(@Value("${notifyhub.messaging.topics.reminder-triggered}") String topic) {
        return TopicBuilder.name(topic + DEAD_LETTER_SUFFIX).partitions(1).replicas(1).build();
    }

    @Bean
    DefaultErrorHandler kafkaErrorHandler(KafkaProperties kafkaProperties) {
        // Undeserializable records arrive as raw bytes; handler failures still carry the typed event.
        DelegatingByTypeSerializer valueSerializer = new DelegatingByTypeSerializer(Map.of(
                byte[].class, new ByteArraySerializer(),
                ReminderTriggeredEvent.class, new JsonSerializer<>()
        ));
        Map<String, Object> producerProperties = kafkaProperties.buildProducerProperties(null);
        producerProperties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        KafkaTemplate<Object, Object> deadLetterTemplate = new KafkaTemplate<>(
                new DefaultKafkaProducerFactory<>(producerProperties, null, valueSerializer)
        );
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                deadLetterTemplate,
                (record, exception) -> new TopicPartition(record.topic() + DEAD_LETTER_SUFFIX, -1)
        );
        return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2L));
    }
}
