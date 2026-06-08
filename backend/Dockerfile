# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# Cache dependencies first
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
# Build
COPY src ./src
RUN mvn -B -q clean package -DskipTests

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Install Chromium + its OS dependencies for Playwright (PdfService). We drive Playwright's own
# CLI through the Spring Boot fat-jar launcher so the browser version stays in lockstep with the
# bundled playwright dependency. PLAYWRIGHT_BROWSERS_PATH is honoured at both install and runtime.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN java -cp app.jar -Dloader.main=com.microsoft.playwright.CLI \
    org.springframework.boot.loader.launch.PropertiesLauncher install --with-deps chromium

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
