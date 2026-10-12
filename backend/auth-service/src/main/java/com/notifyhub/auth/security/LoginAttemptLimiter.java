package com.notifyhub.auth.security;

/**
 * Tracks failed logins per email so brute-force attempts are throttled.
 */
public interface LoginAttemptLimiter {

    boolean isBlocked(String email);

    void recordFailure(String email);

    void reset(String email);
}
