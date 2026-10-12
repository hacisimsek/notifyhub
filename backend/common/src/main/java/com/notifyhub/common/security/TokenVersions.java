package com.notifyhub.common.security;

import java.util.UUID;

/**
 * Shared contract for session revocation: Auth Service stores each user's current token version in Redis under this
 * key, and the Gateway rejects tokens whose {@code ver} claim is older.
 */
public final class TokenVersions {

    public static final String CLAIM = "ver";

    private static final String KEY_PREFIX = "notifyhub:auth:token-version:";

    private TokenVersions() {
    }

    public static String redisKey(UUID userId) {
        return KEY_PREFIX + userId;
    }
}
