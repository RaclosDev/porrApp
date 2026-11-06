package com.porra.mundial.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** La importación de la competición de una liga nueva solo arranca cuando la liga ya está guardada. */
@SpringJUnitConfig(CompetitionImportListenerTest.Config.class)
class CompetitionImportListenerTest {

    @Configuration
    @EnableTransactionManagement
    static class Config {
        @Bean
        CompetitionImportService importService() {
            return mock(CompetitionImportService.class);
        }

        @Bean
        CompetitionImportListener competitionImportListener(CompetitionImportService importService) {
            return new CompetitionImportListener(importService);
        }

        @Bean
        PlatformTransactionManager transactionManager() {
            return new NoOpTransactionManager();
        }
    }

    /** Transacciones sin base de datos: basta con que avisen al confirmar o deshacer. */
    static class NoOpTransactionManager extends AbstractPlatformTransactionManager {
        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
        }
    }

    @Autowired
    private ApplicationEventPublisher publisher;

    @Autowired
    private CompetitionImportService importService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void resetMock() {
        reset(importService);
    }

    @Test
    @DisplayName("Importa al confirmar la transacción de la liga, no durante ella")
    void importsAfterCommit() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            publisher.publishEvent(new CompetitionImportRequestedEvent(5L));
            verify(importService, never()).importCompetitionData(5L);
        });

        verify(importService).importCompetitionData(5L);
    }

    @Test
    @DisplayName("Si la liga no llega a guardarse, no se importa nada")
    void doesNotImportWhenTheLeagueIsRolledBack() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            publisher.publishEvent(new CompetitionImportRequestedEvent(5L));
            status.setRollbackOnly();
        });

        verify(importService, never()).importCompetitionData(5L);
    }

    @Test
    @DisplayName("Un fallo de ESPN al importar no llega a quien creó la liga")
    void swallowsImportFailures() {
        when(importService.importCompetitionData(5L)).thenThrow(new IllegalStateException("ESPN caído"));

        assertDoesNotThrow(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                publisher.publishEvent(new CompetitionImportRequestedEvent(5L))));
        verify(importService).importCompetitionData(5L);
    }
}
