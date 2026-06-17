# Etapa 1: Construcción (Build)
# Usamos una imagen con Maven y Java 21 para compilar el código.
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copiamos el pom.xml y descargamos dependencias (ayuda al caché de Docker)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copiamos el código fuente y compilamos
COPY src ./src
RUN mvn clean package -DskipTests

# Etapa 2: Ejecución (Run)
# Usamos una imagen mucho más ligera de Java 21 solo para ejecutar el .jar
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copiamos el .jar generado en la Etapa 1
COPY --from=build /app/target/*.jar app.jar

# Exponemos el puerto (por documentación, Railway inyectará la variable $PORT)
EXPOSE 8080

# Establecemos la zona horaria a España para que coincida con local
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Comando para ejecutar la aplicación
ENTRYPOINT ["java", "-jar", "app.jar"]
