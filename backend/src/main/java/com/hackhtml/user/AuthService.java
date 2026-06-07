package com.hackhtml.user;

import com.hackhtml.common.ApiException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(String email, String rawPassword, String displayName) {
        String normalized = email.trim().toLowerCase();
        if (users.existsByEmail(normalized)) {
            throw ApiException.conflict("Email already registered");
        }
        User user = new User();
        user.setEmail(normalized);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setDisplayName((displayName == null || displayName.isBlank())
                ? normalized.split("@")[0] : displayName.trim());
        user.getAuthProviders().add(new User.AuthProviderLink(User.Provider.LOCAL, normalized));
        return users.save(user);
    }

    public User authenticate(String email, String rawPassword) {
        User user = users.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password"));
        if (user.getPasswordHash() == null
                || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        return user;
    }

    /** Finds an existing user by email or creates one, linking the OAuth2 provider. */
    public User findOrCreateOAuthUser(String email, String displayName,
                                      User.Provider provider, String providerId) {
        String normalized = email.trim().toLowerCase();
        User user = users.findByEmail(normalized).orElseGet(() -> {
            User u = new User();
            u.setEmail(normalized);
            u.setDisplayName((displayName == null || displayName.isBlank())
                    ? normalized.split("@")[0] : displayName);
            return u;
        });
        if (!user.hasProvider(provider)) {
            user.getAuthProviders().add(new User.AuthProviderLink(provider, providerId));
        }
        user.setUpdatedAt(Instant.now());
        return users.save(user);
    }

    public User getById(String id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
