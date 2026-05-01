package com.notifyhub.auth.api;

import com.notifyhub.auth.domain.AuthUser;

import java.time.Instant;
import java.util.UUID;

record CurrentUserResponse(
        UUID id,
        String email,
        String role,
        Instant createdAt
) {
    static CurrentUserResponse from(AuthUser user) {
        return new CurrentUserResponse(user.getId(), user.getEmail(), user.getRole().name(), user.getCreatedAt());
    }
}
