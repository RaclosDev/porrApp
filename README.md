# Porra Mundial 2026

![Tech Stack](https://img.shields.io/badge/Tech_Stack-React_18_+_Spring_Boot_3-blue)
![License](https://img.shields.io/badge/License-MIT-green)

Plataforma integral para gestionar predicciones (porras) de torneos internacionales como el Mundial.
Permite crear ligas privadas, apostar por el cuadro completo (Fase de Grupos y Eliminatorias) y ofrece un sistema de puntuación en tiempo real sincronizado con eventos oficiales.

## ✨ Características Principales

*   **Autenticación Segura:** Acceso stateless con JWT y Google OAuth.
*   **Ligas Privadas:** Crea grupos, invita a amigos mediante códigos y gestiona apuestas.
*   **Actualizaciones en Tiempo Real:** Integración con WebSockets para propagar los cambios del marcador oficial a todos los usuarios instantáneamente sin recargar la página.
*   **Cálculo Algorítmico Avanzado:** Motor de clasificación de la fase de grupos (O(N log N)) con todos los criterios de desempate FIFA integrados.
*   **Progresión Web App (PWA):** Interfaz rápida (Vite + React) instalable como aplicación nativa. Soporte *Offline-First* con *Workbox*.

## 🛠️ Stack Tecnológico

**Backend (Java 21):**
*   Spring Boot 3.3.0 (Web, Data JPA, Security, WebSockets)
*   PostgreSQL 16
*   Lombok & JWT

**Frontend (TypeScript):**
*   React 18 & Vite 6
*   Tailwind CSS v4
*   React Query & Zustand
*   PWA / Workbox (Service Workers)

## 🏛️ Arquitectura del Sistema

Para consultar el diseño técnico detallado de capas, entidades JPA, gestión de WebSockets y algoritmos de puntuación, consulta la [Documentación de Arquitectura](docs/architecture.md).

## 🚀 Despliegue Rápido (Docker)

El repositorio está completamente dockerizado. Para levantar tanto el Backend (puerto 8080) como la Base de Datos (puerto 5432) en un solo comando:

```bash
# 1. Copia el archivo de variables de entorno
cp .env.example .env

# 2. Levanta los contenedores
docker compose up --build -d
```

> **Nota:** El contenedor del backend automáticamente compila el frontend usando una build multi-etapa y sirve los archivos estáticos generados a través de Spring Boot. Puedes acceder a la aplicación en http://localhost:8080/.

## 📜 Licencia

MIT
