package com.notifyhub.auth.service;

import com.notifyhub.auth.api.AuthResponse;
import com.notifyhub.auth.api.ChangePasswordRequest;
import com.notifyhub.auth.api.LoginRequest;
import com.notifyhub.auth.api.RegisterRequest;
import com.notifyhub.auth.api.UpdateProfileRequest;
import com.notifyhub.auth.domain.AuthUser;
import com.notifyhub.auth.domain.UserRole;
import com.notifyhub.auth.repository.AuthUserRepository;
import com.notifyhub.auth.security.JwtToken;
import com.notifyhub.auth.security.JwtTokenService;
import com.notifyhub.common.logging.AuditLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthService.class);

    private final AuthUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public AuthService(
            AuthUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "error.auth.emailAlreadyRegistered");
        }

        AuthUser user = userRepository.save(new AuthUser(
                email,
                passwordEncoder.encode(request.password()),
                UserRole.USER,
                request.firstName(),
                request.lastName(),
                request.phoneNumber(),
                request.preferredLanguage()
        ));
        audit("auth.register.succeeded", "User %s registered".formatted(user.getEmail()), user)
                .detail("role", user.getRole())
                .log();
        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        AuthUser user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    auditLoginFailure(email, null);
                    return badCredentials();
                });

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            auditLoginFailure(email, user);
            throw badCredentials();
        }

        audit("auth.login.succeeded", "User %s logged in".formatted(user.getEmail()), user)
                .detail("role", user.getRole())
                .log();
        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public AuthUser getCurrentUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "error.auth.userNoLongerExists"));
    }

    @Transactional
    public AuthResponse changePassword(UUID userId, ChangePasswordRequest request) {
        AuthUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "error.auth.userNoLongerExists"));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw badCredentials();
        }

        if (request.currentPassword().equals(request.newPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "error.auth.newPasswordMustDiffer");
        }

        user.changePassword(passwordEncoder.encode(request.newPassword()));
        audit("auth.password.changed", "User %s changed password".formatted(user.getEmail()), user).log();
        return issueToken(user);
    }

    @Transactional
    public AuthResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        AuthUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "error.auth.userNoLongerExists"));

        user.updateProfile(request.firstName(), request.lastName(), request.phoneNumber(), request.preferredLanguage());
        audit("auth.profile.updated", "User %s updated profile".formatted(user.getEmail()), user)
                .detail("preferredLanguage", user.getPreferredLanguage())
                .log();
        return issueToken(user);
    }

    private AuditLogger.Builder audit(String action, String message, AuthUser user) {
        return AuditLogger.event(LOGGER, action, message)
                .category("authentication")
                .user(user.getId(), user.getEmail())
                .resource("user", user.getId());
    }

    private void auditLoginFailure(String email, AuthUser user) {
        AuditLogger.event(LOGGER, "auth.login.failed", "Login failed for %s".formatted(email))
                .category("authentication")
                .outcome("failure")
                .user(user == null ? null : user.getId(), email)
                .resource("user", user == null ? null : user.getId())
                .detail("reason", "invalid_credentials")
                .log();
    }

    private AuthResponse issueToken(AuthUser user) {
        JwtToken token = jwtTokenService.create(user);
        return AuthResponse.bearer(token.value(), token.expiresAt(), user);
    }

    private ResponseStatusException badCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "error.auth.invalidCredentials");
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
