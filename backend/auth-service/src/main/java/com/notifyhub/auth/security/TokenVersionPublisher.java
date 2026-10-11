package com.notifyhub.auth.security;

import java.util.UUID;

/**
 * Publishes a user's current token version so the Gateway can reject tokens issued before a password change.
 */
public interface TokenVersionPublisher {

    void publish(UUID userId, int tokenVersion);
}
