package com.notifyhub.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

@ConfigurationProperties(prefix = "notifyhub.auth.login-throttle")
public record LoginThrottleProperties(
        @DefaultValue("5") int maxFailures,
        @DefaultValue("PT15M") Duration window
) {
}
