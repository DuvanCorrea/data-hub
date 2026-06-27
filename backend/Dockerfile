# ── Build stage ───────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src

# Descarga dependencias en capa separada para mejor cache
RUN ./mvnw dependency:go-offline -B 2>/dev/null || \
    (apt-get install -y maven 2>/dev/null || apk add --no-cache maven) && \
    mvn dependency:go-offline -B

RUN mvn package -DskipTests -B

# ── Runtime stage ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S spring && adduser -S spring -G spring
RUN mkdir -p /app/files && chown -R spring:spring /app/files /app

USER spring:spring

COPY --from=build /app/target/*.jar app.jar

# Directorio de almacenamiento de archivos Excel
VOLUME /app/files

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
