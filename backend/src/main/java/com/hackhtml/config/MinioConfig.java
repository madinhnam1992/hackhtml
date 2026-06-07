package com.hackhtml.config;

import io.minio.MinioClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class MinioConfig {

    @Bean
    public MinioClient minioClient(AppProperties props) {
        AppProperties.Minio m = props.getMinio();
        return MinioClient.builder()
                .endpoint(m.getEndpoint())
                .credentials(m.getAccessKey(), m.getSecretKey())
                .build();
    }
}
