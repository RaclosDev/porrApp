// Script de recuperación de emergencia
console.log("Recuperando versión desactualizada...");
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
        // Forzar recarga sin caché
        setTimeout(() => {
            window.location.reload(true);
        }, 500);
    });
} else {
    window.location.reload(true);
}
