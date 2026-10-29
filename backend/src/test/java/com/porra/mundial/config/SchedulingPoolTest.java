package com.porra.mundial.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.core.type.filter.AnnotationTypeFilter;

import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/** Cada tarea programada tiene que poder correr sin esperar a las demás. */
class SchedulingPoolTest {

    @Test
    void schedulerHasAThreadForEveryScheduledTask() throws Exception {
        Properties properties = new Properties();
        // La de src/main: en el classpath de los tests la tapa la de src/test.
        try (Reader reader = Files.newBufferedReader(Path.of("src/main/resources/application.properties"),
                StandardCharsets.UTF_8)) {
            properties.load(reader);
        }
        int poolSize = Integer.parseInt(properties.getProperty("spring.task.scheduling.pool.size", "1"));

        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));
        long scheduledTasks = 0;
        for (BeanDefinition bean : scanner.findCandidateComponents("com.porra.mundial")) {
            scheduledTasks += Arrays.stream(Class.forName(bean.getBeanClassName()).getDeclaredMethods())
                    .filter(method -> method.isAnnotationPresent(Scheduled.class))
                    .count();
        }

        assertThat(scheduledTasks).isGreaterThanOrEqualTo(2);
        assertThat(poolSize).isGreaterThanOrEqualTo((int) scheduledTasks);
    }
}
