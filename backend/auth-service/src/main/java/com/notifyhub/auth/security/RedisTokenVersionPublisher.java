package com.notifyhub.auth.security;

import com.notifyhub.common.security.TokenVersions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@ConditionalOnProperty(prefix = "notifyhub.auth.token-revocation", name = "redis-enabled", havingValue = "true")
class RedisTokenVersionPublisher implements TokenVersionPublisher {

    private static final Logger LOGGER = LoggerFactory.getLogger(RedisTokenVersionPublisher.class);

    private final StringRedisTemplate redisTemplate;

    RedisTokenVersionPublisher(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void publish(UUID userId, int tokenVersion) {
        try {
            redisTemplate.opsForValue().set(TokenVersions.redisKey(userId), Integer.toString(tokenVersion));
        } catch (DataAccessException ex) {
            // Auth Service still rejects old tokens on its own routes; only Gateway-side revocation is delayed.
            LOGGER.warn("Token version for user {} was not published because Redis is unavailable", userId, ex);
        }
    }
}
