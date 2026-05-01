package com.notifyhub.gateway.security;

import java.util.UUID;

public record GatewayPrincipal(UUID userId, String email, String role) {
}
