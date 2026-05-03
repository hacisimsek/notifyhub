package com.notifyhub.auth.api;

import com.notifyhub.auth.domain.AuthUser;

import java.time.Instant;
import java.util.UUID;

record CurrentUserResponse(
        UUID id,
        String email,
        String role,
        String firstName,
        String lastName,
        String phoneNumber,
        Instant createdAt
) {
    static CurrentUserResponse from(AuthUser user) {
        return new CurrentUserResponse(
                user.getId(),
                user.getEmail(),
                user.getRole().name(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhoneNumber(),
                user.getCreatedAt()
        );
    }
}
