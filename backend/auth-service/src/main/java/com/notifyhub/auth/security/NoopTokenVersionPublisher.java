package com.notifyhub.auth.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Used when Redis is disabled; Auth Service still rejects revoked tokens on its own routes.
 */
@Component
@ConditionalOnProperty(prefix = "notifyhub.auth.token-revocation", name = "redis-enabled", havingValue = "false", matchIfMissing = true)
class NoopTokenVersionPublisher implements TokenVersionPublisher {

    @Override
    public void publish(UUID userId, int tokenVersion) {
    }
}
