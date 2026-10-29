package com.porra.mundial.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Semaphore;

import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

class ImageProcessorTest {

    static byte[] image(int w, int h, String format, boolean alpha) throws Exception {
        BufferedImage img = new BufferedImage(w, h, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < w; x += 5) {
            for (int y = 0; y < h; y += 5) {
                img.setRGB(x, y, 0xFF3366CC);
            }
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    @Test
    @DisplayName("Reduce un PNG grande a 512 px conservando proporción y transparencia")
    void downscalesLargePng() throws Exception {
        ImageProcessor.ProcessedImage result = ImageProcessor.process(image(2000, 1000, "png", true));

        assertEquals("image/png", result.contentType());
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result.data()));
        assertEquals(512, decoded.getWidth());
        assertEquals(256, decoded.getHeight());
        assertTrue(decoded.getColorModel().hasAlpha());
    }

    @Test
    @DisplayName("Acepta JPEG y no amplía imágenes pequeñas")
    void keepsSmallJpeg() throws Exception {
        ImageProcessor.ProcessedImage result = ImageProcessor.process(image(300, 300, "jpg", false));

        assertEquals("image/jpeg", result.contentType());
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result.data()));
        assertEquals(300, decoded.getWidth());
        assertEquals(300, decoded.getHeight());
    }

    @Test
    @DisplayName("Rechaza archivos vacíos, texto, SVG y GIF aunque lleguen con otro Content-Type")
    void rejectsNonImages() {
        assertThrows(IllegalArgumentException.class, () -> ImageProcessor.process(new byte[0]));
        assertThrows(IllegalArgumentException.class,
                () -> ImageProcessor.process("<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8)));
        assertThrows(IllegalArgumentException.class,
                () -> ImageProcessor.process("<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8)));
        assertThrows(IllegalArgumentException.class,
                () -> ImageProcessor.process("GIF89a....".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    @DisplayName("Rechaza cabeceras PNG/JPEG falsas que no contienen una imagen decodificable")
    void rejectsSpoofedHeaders() {
        byte[] fakePng = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4};
        byte[] fakeJpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 1, 2};
        assertThrows(IllegalArgumentException.class, () -> ImageProcessor.process(fakePng));
        assertThrows(IllegalArgumentException.class, () -> ImageProcessor.process(fakeJpeg));
    }

    @Test
    @DisplayName("Rechaza archivos por encima de 3 MB")
    void rejectsOversizedUpload() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> ImageProcessor.process(new byte[ImageProcessor.MAX_UPLOAD_BYTES + 1]));
        assertTrue(ex.getMessage().contains("3 MB"));
    }

    @Test
    @DisplayName("Rechaza imágenes con demasiados píxeles antes de decodificarlas")
    void rejectsPixelBomb() throws Exception {
        byte[] bomb = image(6000, 6000, "png", false); // ~36 MP, pesa muy poco comprimido
        assertTrue(bomb.length < ImageProcessor.MAX_UPLOAD_BYTES);
        assertThrows(IllegalArgumentException.class, () -> ImageProcessor.process(bomb));
    }

    @Test
    @DisplayName("Descarta datos añadidos tras la imagen (polyglots)")
    void stripsTrailingData() throws Exception {
        byte[] png = image(50, 50, "png", false);
        byte[] trailer = "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8);
        byte[] polyglot = new byte[png.length + trailer.length];
        System.arraycopy(png, 0, polyglot, 0, png.length);
        System.arraycopy(trailer, 0, polyglot, png.length, trailer.length);

        ImageProcessor.ProcessedImage result = ImageProcessor.process(polyglot);

        assertFalse(new String(result.data(), StandardCharsets.ISO_8859_1).contains("<script>"));
    }

    @Test
    @DisplayName("El máximo es de unos 6 MP; por debajo se decodifica submuestreada y se reduce a 512 px")
    void enforcesSixMegapixelsAndSubsamples() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> ImageProcessor.process(image(3000, 2400, "png", false)));

        assertEquals(2, ImageProcessor.subsampling(2400, 2400));
        assertEquals(1, ImageProcessor.subsampling(1000, 500));
        ImageProcessor.ProcessedImage result = ImageProcessor.process(image(2400, 2400, "jpg", false));
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result.data()));
        assertEquals(512, decoded.getWidth());
        assertEquals(512, decoded.getHeight());
    }

    @Test
    @DisplayName("Si ya hay demasiadas imágenes procesándose responde 503 y siempre libera su hueco")
    void limitsConcurrentDecodes() throws Exception {
        byte[] png = image(50, 50, "png", false);

        ResponseStatusException busy = assertThrows(ResponseStatusException.class,
                () -> ImageProcessor.process(png, new Semaphore(0), 10));
        assertEquals(503, busy.getStatusCode().value());

        Semaphore slots = new Semaphore(1);
        ImageProcessor.process(png, slots, 10);
        byte[] fakePng = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4};
        assertThrows(IllegalArgumentException.class, () -> ImageProcessor.process(fakePng, slots, 10));
        assertEquals(1, slots.availablePermits());
    }
}
