package com.porra.mundial.controller;

import com.porra.mundial.exception.BusinessException;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.NoSuchElementException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ExceptionProbeController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void mapsExplicitBusinessErrorsToTheirPublicStatusAndMessage() throws Exception {
        assertBusinessError("bad-request", 400, "El nombre no puede estar vacío");
        assertBusinessError("forbidden", 403, "No perteneces a esta liga privada");
        assertBusinessError("not-found", 404, "Liga no encontrada");
        assertBusinessError("conflict", 409, "El plazo para pronosticar ha finalizado");
    }

    @Test
    void hidesMessagesFromUnclassifiedTechnicalExceptions() throws Exception {
        for (String type : new String[] {"illegal-argument", "illegal-state", "security", "not-found", "null-pointer", "persistence"}) {
            mockMvc.perform(get("/errors/technical/{type}", type))
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.error").value("Ha ocurrido un error inesperado en el servidor."));
        }
    }

    @Test
    void accessDeniedUsesFixedPublicMessage() throws Exception {
        mockMvc.perform(get("/errors/access-denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Acceso denegado."));
    }

    @Test
    void responseStatusExceptionKeepsItsExplicitClientReason() throws Exception {
        mockMvc.perform(get("/errors/response-status"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Invitación no válida o caducada"));
    }

    @Test
    void responseStatusExceptionWithoutReasonUsesSafeFallback() throws Exception {
        mockMvc.perform(get("/errors/response-status-empty"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"));
    }

    @Test
    void internalResponseStatusExceptionDoesNotExposeItsReason() throws Exception {
        mockMvc.perform(get("/errors/response-status-internal"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Ha ocurrido un error inesperado en el servidor."));
    }

    private void assertBusinessError(String type, int status, String message) throws Exception {
        mockMvc.perform(get("/errors/business/{type}", type))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.error").value(message));
    }

    @RestController
    static class ExceptionProbeController {

        @GetMapping("/errors/business/{type}")
        void business(@PathVariable String type) {
            String message = switch (type) {
                case "bad-request" -> "El nombre no puede estar vacío";
                case "forbidden" -> "No perteneces a esta liga privada";
                case "not-found" -> "Liga no encontrada";
                case "conflict" -> "El plazo para pronosticar ha finalizado";
                default -> throw new IllegalArgumentException("Tipo de prueba inválido");
            };
            throw switch (type) {
                case "bad-request" -> BusinessException.badRequest(message);
                case "forbidden" -> BusinessException.forbidden(message);
                case "not-found" -> BusinessException.notFound(message);
                default -> BusinessException.conflict(message);
            };
        }

        @GetMapping("/errors/technical/{type}")
        void technical(@PathVariable String type) {
            throw switch (type) {
                case "illegal-argument" -> new IllegalArgumentException("ruta C:\\private\\db.json");
                case "illegal-state" -> new IllegalStateException("secret config key");
                case "security" -> new SecurityException("internal role expression");
                case "not-found" -> new NoSuchElementException("No value present");
                case "null-pointer" -> new NullPointerException("secret object name");
                default -> new PersistenceException("SQL table and column details");
            };
        }

        @GetMapping("/errors/access-denied")
        void accessDenied() {
            throw new AccessDeniedException("hasRole('ROLE_INTERNAL')");
        }

        @GetMapping("/errors/response-status")
        void responseStatus() {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitación no válida o caducada");
        }

        @GetMapping("/errors/response-status-empty")
        void responseStatusEmpty() {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }

        @GetMapping("/errors/response-status-internal")
        void responseStatusInternal() {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "C:\\private\\database.json");
        }
    }
}
