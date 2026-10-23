# Etapa 1: Build del Frontend (React + Vite)
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

# Instalamos dependencias primero (mejor uso del cache de Docker)
COPY frontend/package*.json ./
RUN npm ci

# Copiamos el codigo fuente del frontend y compilamos
COPY frontend/ ./
RUN npm run build
# El resultado queda en /app/frontend/dist

# Etapa 2: Build del Backend (Spring Boot + Maven)
FROM maven:3.9.6-eclipse-temurin-21 AS backend-build
WORKDIR /app

# Copiamos el pom.xml y descargamos dependencias (cache)
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B

# Copiamos fuentes Java
COPY backend/src ./src

# Copiamos el frontend compilado a los recursos estaticos de Spring Boot
COPY --from=frontend-build /app/frontend/dist ./src/main/resources/static

# Compilamos el backend (el .jar ya incluira el frontend)
RUN mvn clean package -DskipTests

# Etapa 3: Imagen de produccion (JRE minimo Alpine)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=backend-build /app/target/*.jar app.jar

EXPOSE 8080 10000

ENV TZ=Europe/Madrid
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone && \
    apk del tzdata

ENV SPRING_PROFILES_ACTIVE=prod

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/actuator/health > /dev/null || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
