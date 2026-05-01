package com.notifyhub.auth.service;

import com.notifyhub.auth.api.AuthResponse;
import com.notifyhub.auth.api.LoginRequest;
import com.notifyhub.auth.api.RegisterRequest;
import com.notifyhub.auth.domain.AuthUser;
import com.notifyhub.auth.domain.UserRole;
import com.notifyhub.auth.repository.AuthUserRepository;
import com.notifyhub.auth.security.JwtToken;
import com.notifyhub.auth.security.JwtTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

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
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }

        AuthUser user = userRepository.save(new AuthUser(
                email,
                passwordEncoder.encode(request.password()),
                UserRole.USER
        ));
        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        AuthUser user = userRepository.findByEmail(email)
                .orElseThrow(this::badCredentials);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw badCredentials();
        }

        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public AuthUser getCurrentUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User no longer exists"));
    }

    private AuthResponse issueToken(AuthUser user) {
        JwtToken token = jwtTokenService.create(user);
        return AuthResponse.bearer(token.value(), token.expiresAt(), user);
    }

    private ResponseStatusException badCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
