package com.notifyhub.auth.security;

import com.notifyhub.auth.config.LoginThrottleProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Shares failed-login counters across auth-service replicas. Fails open if Redis is unavailable,
 * so a cache outage degrades brute-force protection instead of blocking every login.
 */
@Component
@ConditionalOnProperty(prefix = "notifyhub.auth.login-throttle", name = "redis-enabled", havingValue = "true")
class RedisLoginAttemptLimiter implements LoginAttemptLimiter {

    private static final Logger LOGGER = LoggerFactory.getLogger(RedisLoginAttemptLimiter.class);
    private static final String KEY_PREFIX = "notifyhub:auth:login-failures:";

    private final StringRedisTemplate redisTemplate;
    private final LoginThrottleProperties properties;

    RedisLoginAttemptLimiter(StringRedisTemplate redisTemplate, LoginThrottleProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    @Override
    public boolean isBlocked(String email) {
        try {
            String failures = redisTemplate.opsForValue().get(key(email));
            return failures != null && Long.parseLong(failures) >= properties.maxFailures();
        } catch (DataAccessException ex) {
            LOGGER.warn("Login throttle check skipped because Redis is unavailable", ex);
            return false;
        }
    }

    @Override
    public void recordFailure(String email) {
        try {
            Long failures = redisTemplate.opsForValue().increment(key(email));
            if (failures != null && failures == 1L) {
                redisTemplate.expire(key(email), properties.window());
            }
        } catch (DataAccessException ex) {
            LOGGER.warn("Login failure was not recorded because Redis is unavailable", ex);
        }
    }

    @Override
    public void reset(String email) {
        try {
            redisTemplate.delete(key(email));
        } catch (DataAccessException ex) {
            LOGGER.warn("Login throttle reset skipped because Redis is unavailable", ex);
        }
    }

    private String key(String email) {
        return KEY_PREFIX + email;
    }
}
