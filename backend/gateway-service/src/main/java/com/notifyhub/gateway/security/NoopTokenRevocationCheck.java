package com.notifyhub.gateway.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.gateway.token-revocation", name = "redis-enabled", havingValue = "false", matchIfMissing = true)
class NoopTokenRevocationCheck implements TokenRevocationCheck {

    @Override
    public boolean isRevoked(GatewayPrincipal principal) {
        return false;
    }
}
