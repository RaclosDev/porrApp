# Imágenes base fijadas por digest; Dependabot (ecosistema docker) las actualiza.

# Etapa 1: Build del Frontend (React + Vite)
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS frontend-build
WORKDIR /app/frontend

# Instalamos dependencias primero (mejor uso del cache de Docker)
COPY frontend/package*.json ./
RUN npm ci

# Copiamos el codigo fuente del frontend y compilamos
COPY frontend/ ./
ARG VITE_GOOGLE_CLIENT_ID
RUN npm run build
# El resultado queda en /app/frontend/dist

# Etapa 2: Build del Backend (Spring Boot + Maven Wrapper, misma versión de Maven que en local y CI)
FROM eclipse-temurin:24-jdk-alpine@sha256:8fdbcb6bc6b846640cea7058e6eeb56c311fae4efaa506a213789134065c6b90 AS backend-build
WORKDIR /app

# Copiamos el wrapper y el pom.xml y descargamos dependencias (cache)
COPY backend/mvnw backend/pom.xml ./
COPY backend/.mvn ./.mvn
RUN sh ./mvnw dependency:go-offline -B

# Copiamos fuentes Java
COPY backend/src ./src

# Sustituimos los estáticos por la build del frontend (el .jar ya incluira el frontend)
RUN rm -rf ./src/main/resources/static
COPY --from=frontend-build /app/frontend/dist ./src/main/resources/static

RUN sh ./mvnw clean package -DskipTests -B

# Etapa 3: Imagen de produccion (JRE minimo Alpine)
FROM eclipse-temurin:24-jre-alpine@sha256:4044b6c87cb088885bcd0220f7dc7a8a4aab76577605fa471945d2e98270741f
WORKDIR /app

# Crear usuario y grupo sin privilegios para mitigar riesgos de contenedor
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

ENV TZ=Europe/Madrid
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone && \
    apk del tzdata

# El jar queda con dueño root: appuser solo puede leerlo
COPY --from=backend-build /app/target/*.jar app.jar

EXPOSE 8080

ENV SPRING_PROFILES_ACTIVE=prod
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/actuator/health/liveness > /dev/null || exit 1

USER appuser:appgroup

ENTRYPOINT ["java", "-Dfile.encoding=UTF-8", "-Dsun.jnu.encoding=UTF-8", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-Xss256k", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
