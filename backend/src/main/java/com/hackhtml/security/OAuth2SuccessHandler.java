package com.hackhtml.security;

import com.hackhtml.config.AppProperties;
import com.hackhtml.user.AuthService;
import com.hackhtml.user.User;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

/**
 * After a successful OAuth2 login we mint our own JWT (unifying both auth methods) and redirect
 * the browser back to the frontend's OAuth callback page with the token as a query param.
 */
@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;
    private final JwtService jwtService;
    private final AppProperties props;

    public OAuth2SuccessHandler(AuthService authService, JwtService jwtService, AppProperties props) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.props = props;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        String registrationId = token.getAuthorizedClientRegistrationId(); // "google" | "github"
        OAuth2User principal = token.getPrincipal();

        User.Provider provider = "github".equals(registrationId)
                ? User.Provider.GITHUB : User.Provider.GOOGLE;

        String email = extractEmail(principal, provider);
        String name = extractName(principal, provider);
        String providerId = String.valueOf(principal.getAttributes().getOrDefault("id",
                principal.getAttributes().getOrDefault("sub", email)));

        if (email == null || email.isBlank()) {
            getRedirectStrategy().sendRedirect(request, response,
                    props.getFrontendUrl() + "/login?error=no_email");
            return;
        }

        User user = authService.findOrCreateOAuthUser(email, name, provider, providerId);
        String jwt = jwtService.generateToken(user.getId(), user.getEmail());

        String target = UriComponentsBuilder
                .fromUriString(props.getFrontendUrl() + "/oauth2/callback")
                .queryParam("token", jwt)
                .build().toUriString();

        getRedirectStrategy().sendRedirect(request, response, target);
    }

    private String extractEmail(OAuth2User principal, User.Provider provider) {
        Object email = principal.getAttributes().get("email");
        return email != null ? email.toString() : null;
    }

    private String extractName(OAuth2User principal, User.Provider provider) {
        Object name = principal.getAttributes().get("name");
        if (name == null && provider == User.Provider.GITHUB) {
            name = principal.getAttributes().get("login");
        }
        return name != null ? name.toString() : null;
    }
}
