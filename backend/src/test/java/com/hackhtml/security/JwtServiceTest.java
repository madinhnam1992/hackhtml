package com.hackhtml.security;

import com.hackhtml.config.AppProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class JwtServiceTest {

    private JwtService newService() {
        AppProperties props = new AppProperties();
        props.getJwt().setSecret("test-secret-that-is-at-least-32-bytes-long-xxx");
        props.getJwt().setExpirationMs(60_000L);
        return new JwtService(props);
    }

    @Test
    void generatesAndValidatesToken() {
        JwtService svc = newService();
        String token = svc.generateToken("user-123", "a@b.com");
        assertEquals("user-123", svc.validateAndGetUserId(token));
    }

    @Test
    void rejectsTamperedToken() {
        JwtService svc = newService();
        String token = svc.generateToken("user-123", "a@b.com");
        assertNull(svc.validateAndGetUserId(token + "tampered"));
    }

    @Test
    void rejectsGarbage() {
        JwtService svc = newService();
        assertNull(svc.validateAndGetUserId("not-a-jwt"));
    }
}
