package com.hackhtml.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;

import java.util.ArrayList;
import java.util.List;

/**
 * Builds an {@link ClientRegistrationRepository} only for providers that have credentials configured.
 * If neither Google nor GitHub is configured, no bean is created and OAuth2 login stays disabled —
 * this keeps the app bootable without any OAuth2 setup.
 */
@Configuration
public class OAuth2Config {

    @Bean
    public ClientRegistrationRepository clientRegistrationRepository(AppProperties props) {
        List<ClientRegistration> registrations = new ArrayList<>();

        AppProperties.OAuth2.Provider google = props.getOauth2().getGoogle();
        if (google.isConfigured()) {
            registrations.add(CommonOAuth2Provider.GOOGLE
                    .getBuilder("google")
                    .clientId(google.getClientId())
                    .clientSecret(google.getClientSecret())
                    .build());
        }

        AppProperties.OAuth2.Provider github = props.getOauth2().getGithub();
        if (github.isConfigured()) {
            registrations.add(CommonOAuth2Provider.GITHUB
                    .getBuilder("github")
                    .clientId(github.getClientId())
                    .clientSecret(github.getClientSecret())
                    .build());
        }

        if (registrations.isEmpty()) {
            // No provider configured: hand back an empty repository so security can detect "disabled".
            return registrationId -> null;
        }
        return new InMemoryClientRegistrationRepository(registrations);
    }
}
