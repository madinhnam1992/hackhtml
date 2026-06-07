package com.hackhtml.config;

import com.mongodb.ConnectionString;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.mongodb.autoconfigure.MongoConnectionDetails;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot 4 does not reliably bind a placeholder-backed {@code spring.data.mongodb.uri}
 * into MongoProperties (it can fall back to mongodb://localhost/test). Supplying an explicit
 * {@link MongoConnectionDetails} bean takes precedence and makes the connection string
 * deterministic from the {@code MONGODB_URI} environment variable.
 */
@Configuration
public class MongoConfig {

    @Bean
    public MongoConnectionDetails mongoConnectionDetails(
            @Value("${MONGODB_URI:mongodb://root:changeme@localhost:27017/hackhtml?authSource=admin}")
            String uri) {
        ConnectionString connectionString = new ConnectionString(uri);
        return () -> connectionString;
    }
}
