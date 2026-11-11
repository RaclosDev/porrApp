package app.porrapp.controller;

import app.porrapp.service.notification.PushRetryQueue;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PushReceiptController {
    private final PushRetryQueue queue;

    public record Receipt(UUID token) {}

    // El token aleatorio viaja dentro del push cifrado. Solo autoriza confirmar ese aviso;
    // no requiere la sesión de la app, que puede estar cerrada o haber caducado.
    @PostMapping("/api/push/receipts")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acknowledge(@RequestBody Receipt receipt) {
        queue.acknowledge(receipt.token());
    }
}
