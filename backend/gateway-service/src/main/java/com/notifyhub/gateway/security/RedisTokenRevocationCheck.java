package com.notifyhub.gateway.security;

import com.notifyhub.common.security.TokenVersions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Compares the token's version with the one Auth Service published. Fails open when Redis is unavailable,
 * so a cache outage delays revocation instead of logging every user out; Auth Service still checks its own routes.
 */
@Component
@ConditionalOnProperty(prefix = "notifyhub.gateway.token-revocation", name = "redis-enabled", havingValue = "true")
class RedisTokenRevocationCheck implements TokenRevocationCheck {

    private static final Logger LOGGER = LoggerFactory.getLogger(RedisTokenRevocationCheck.class);

    private final StringRedisTemplate redisTemplate;

    RedisTokenRevocationCheck(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean isRevoked(GatewayPrincipal principal) {
        try {
            String currentVersion = redisTemplate.opsForValue().get(TokenVersions.redisKey(principal.userId()));
            return currentVersion != null && principal.tokenVersion() < Integer.parseInt(currentVersion);
        } catch (DataAccessException ex) {
            LOGGER.warn("Token revocation check skipped because Redis is unavailable", ex);
            return false;
        }
    }
}
