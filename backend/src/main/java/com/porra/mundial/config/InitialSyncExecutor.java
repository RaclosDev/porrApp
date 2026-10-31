package com.porra.mundial.config;

import org.springframework.context.annotation.DependsOn;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

/** Se cierra antes que JPA para que el worker no use conexiones ya destruidas. */
@Component
@DependsOn("entityManagerFactory")
public class InitialSyncExecutor extends ThreadPoolTaskExecutor {
    public InitialSyncExecutor() {
        setCorePoolSize(1);
        setMaxPoolSize(1);
        setQueueCapacity(1);
        setThreadNamePrefix("initial-sync-");
        setWaitForTasksToCompleteOnShutdown(false);
        setAwaitTerminationSeconds(30);
    }
}
