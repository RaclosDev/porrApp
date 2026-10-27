package com.porra.mundial.controller;

import com.porra.mundial.service.ProfileImageService.StoredImage;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.WebRequest;

import java.time.ZoneOffset;
import java.util.concurrent.TimeUnit;

/** Construye respuestas HTTP para imágenes almacenadas, con ETag y caché. */
final class ImageResponses {

    private ImageResponses() {
    }

    static ResponseEntity<byte[]> serve(StoredImage image, WebRequest request) {
        String etag = "\"" + image.updatedAt().toInstant(ZoneOffset.UTC).toEpochMilli() + "\"";
        if (request.checkNotModified(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic())
                .eTag(etag)
                .header("Content-Disposition", "inline")
                .body(image.data());
    }
}
