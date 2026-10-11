package com.notifyhub.auth.security;

import com.notifyhub.auth.config.LoginThrottleProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Single-instance fallback used when Redis is disabled (tests and plain local runs).
 */
@Component
@ConditionalOnProperty(prefix = "notifyhub.auth.login-throttle", name = "redis-enabled", havingValue = "false", matchIfMissing = true)
class InMemoryLoginAttemptLimiter implements LoginAttemptLimiter {

    private final LoginThrottleProperties properties;
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    InMemoryLoginAttemptLimiter(LoginThrottleProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean isBlocked(String email) {
        Attempts current = attempts.get(email);
        return current != null && !current.expired(Instant.now()) && current.failures() >= properties.maxFailures();
    }

    @Override
    public void recordFailure(String email) {
        Instant now = Instant.now();
        attempts.compute(email, (key, current) -> current == null || current.expired(now)
                ? new Attempts(1, now.plus(properties.window()))
                : new Attempts(current.failures() + 1, current.expiresAt()));
    }

    @Override
    public void reset(String email) {
        attempts.remove(email);
    }

    private record Attempts(int failures, Instant expiresAt) {
        boolean expired(Instant now) {
            return !now.isBefore(expiresAt);
        }
    }
}
