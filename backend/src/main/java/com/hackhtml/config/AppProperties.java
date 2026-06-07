package com.hackhtml.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Strongly-typed access to the {@code app.*} configuration namespace.
 */
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Jwt jwt = new Jwt();
    private final Minio minio = new Minio();
    private final OAuth2 oauth2 = new OAuth2();
    private String frontendUrl = "http://localhost:3000";

    public Jwt getJwt() { return jwt; }
    public Minio getMinio() { return minio; }
    public OAuth2 getOauth2() { return oauth2; }
    public String getFrontendUrl() { return frontendUrl; }
    public void setFrontendUrl(String frontendUrl) { this.frontendUrl = frontendUrl; }

    public static class Jwt {
        private String secret;
        private long expirationMs = 86_400_000L;

        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public long getExpirationMs() { return expirationMs; }
        public void setExpirationMs(long expirationMs) { this.expirationMs = expirationMs; }
    }

    public static class Minio {
        private String endpoint;
        private String accessKey;
        private String secretKey;
        private String bucket;

        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public String getBucket() { return bucket; }
        public void setBucket(String bucket) { this.bucket = bucket; }
    }

    public static class OAuth2 {
        private final Provider google = new Provider();
        private final Provider github = new Provider();

        public Provider getGoogle() { return google; }
        public Provider getGithub() { return github; }

        public static class Provider {
            private String clientId;
            private String clientSecret;

            public String getClientId() { return clientId; }
            public void setClientId(String clientId) { this.clientId = clientId; }
            public String getClientSecret() { return clientSecret; }
            public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }

            public boolean isConfigured() {
                return clientId != null && !clientId.isBlank()
                        && clientSecret != null && !clientSecret.isBlank();
            }
        }
    }
}
