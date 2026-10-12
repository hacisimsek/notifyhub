package com.notifyhub.gateway.security;

/**
 * Tells whether a verified token was issued before the user's latest password change.
 */
public interface TokenRevocationCheck {

    boolean isRevoked(GatewayPrincipal principal);
}
