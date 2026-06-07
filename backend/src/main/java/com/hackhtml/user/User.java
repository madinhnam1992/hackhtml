package com.hackhtml.user;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "users")
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    /** Null when the account was created purely through an OAuth2 provider. */
    private String passwordHash;

    private String displayName;

    private List<AuthProviderLink> authProviders = new ArrayList<>();

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public enum Provider { LOCAL, GOOGLE, GITHUB }

    public static class AuthProviderLink {
        private Provider provider;
        private String providerId;

        public AuthProviderLink() {}
        public AuthProviderLink(Provider provider, String providerId) {
            this.provider = provider;
            this.providerId = providerId;
        }
        public Provider getProvider() { return provider; }
        public void setProvider(Provider provider) { this.provider = provider; }
        public String getProviderId() { return providerId; }
        public void setProviderId(String providerId) { this.providerId = providerId; }
    }

    public boolean hasProvider(Provider provider) {
        return authProviders.stream().anyMatch(p -> p.getProvider() == provider);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public List<AuthProviderLink> getAuthProviders() { return authProviders; }
    public void setAuthProviders(List<AuthProviderLink> authProviders) { this.authProviders = authProviders; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
