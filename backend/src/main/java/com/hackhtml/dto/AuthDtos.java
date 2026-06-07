package com.hackhtml.dto;

import com.hackhtml.user.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @Email @NotBlank String email,
            @NotBlank @Size(min = 6, max = 100) String password,
            String displayName) {}

    public record LoginRequest(
            @Email @NotBlank String email,
            @NotBlank String password) {}

    public record AuthResponse(String token, UserResponse user) {}

    public record UserResponse(String id, String email, String displayName) {
        public static UserResponse from(User u) {
            return new UserResponse(u.getId(), u.getEmail(), u.getDisplayName());
        }
    }
}
