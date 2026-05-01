package com.notifyhub.notification.delivery;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "notifyhub.delivery.rabbitmq")
public class NotificationRabbitProperties {

    private boolean enabled = false;
    private String exchange = "notifyhub.notifications.delivery";
    private String retryExchange = "notifyhub.notifications.retry";
    private String deadLetterExchange = "notifyhub.notifications.dlx";
    private String queue = "notifyhub.notifications.delivery";
    private String retryQueue = "notifyhub.notifications.delivery.retry";
    private String deadLetterQueue = "notifyhub.notifications.delivery.dlq";
    private String routingKey = "notification.delivery";
    private String retryRoutingKey = "notification.retry";
    private String deadLetterRoutingKey = "notification.failed";
    private int maxAttempts = 3;
    private long retryDelayMs = 5000;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getExchange() {
        return exchange;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public String getRetryExchange() {
        return retryExchange;
    }

    public void setRetryExchange(String retryExchange) {
        this.retryExchange = retryExchange;
    }

    public String getDeadLetterExchange() {
        return deadLetterExchange;
    }

    public void setDeadLetterExchange(String deadLetterExchange) {
        this.deadLetterExchange = deadLetterExchange;
    }

    public String getQueue() {
        return queue;
    }

    public void setQueue(String queue) {
        this.queue = queue;
    }

    public String getRetryQueue() {
        return retryQueue;
    }

    public void setRetryQueue(String retryQueue) {
        this.retryQueue = retryQueue;
    }

    public String getDeadLetterQueue() {
        return deadLetterQueue;
    }

    public void setDeadLetterQueue(String deadLetterQueue) {
        this.deadLetterQueue = deadLetterQueue;
    }

    public String getRoutingKey() {
        return routingKey;
    }

    public void setRoutingKey(String routingKey) {
        this.routingKey = routingKey;
    }

    public String getRetryRoutingKey() {
        return retryRoutingKey;
    }

    public void setRetryRoutingKey(String retryRoutingKey) {
        this.retryRoutingKey = retryRoutingKey;
    }

    public String getDeadLetterRoutingKey() {
        return deadLetterRoutingKey;
    }

    public void setDeadLetterRoutingKey(String deadLetterRoutingKey) {
        this.deadLetterRoutingKey = deadLetterRoutingKey;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public long getRetryDelayMs() {
        return retryDelayMs;
    }

    public void setRetryDelayMs(long retryDelayMs) {
        this.retryDelayMs = retryDelayMs;
    }
}
