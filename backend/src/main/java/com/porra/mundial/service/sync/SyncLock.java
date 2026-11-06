package com.porra.mundial.service.sync;

import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Cerrojo de la sincronización con el proveedor. Lo comparten la sincronización programada y la
 * importación de competiciones, para que las dos no creen el mismo partido a la vez.
 */
@Component
public class SyncLock {

    private final ReentrantLock lock = new ReentrantLock();

    public boolean tryLock() {
        return lock.tryLock();
    }

    public boolean tryLock(long timeout, TimeUnit unit) throws InterruptedException {
        return lock.tryLock(timeout, unit);
    }

    public void unlock() {
        lock.unlock();
    }
}
