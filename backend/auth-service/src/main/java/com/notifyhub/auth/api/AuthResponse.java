package com.notifyhub.auth.api;

import com.notifyhub.auth.domain.AuthUser;

import java.time.Instant;
import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        UserSummary user
) {
    public static AuthResponse bearer(String accessToken, Instant expiresAt, AuthUser user) {
        return new AuthResponse(accessToken, "Bearer", expiresAt, UserSummary.from(user));
    }

    public record UserSummary(
            UUID id,
            String email,
            String role,
            String firstName,
            String lastName,
            String phoneNumber,
            String preferredLanguage
    ) {
        static UserSummary from(AuthUser user) {
            return new UserSummary(
                    user.getId(),
                    user.getEmail(),
                    user.getRole().name(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getPhoneNumber(),
                    user.getPreferredLanguage()
            );
        }
    }
}
