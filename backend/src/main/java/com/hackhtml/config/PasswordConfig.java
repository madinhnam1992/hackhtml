package com.hackhtml.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Kept separate from SecurityConfig so that beans needing a PasswordEncoder (e.g. AuthService)
 * don't create a circular dependency with SecurityConfig, which itself depends on the
 * OAuth2 success handler that uses AuthService.
 */
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
