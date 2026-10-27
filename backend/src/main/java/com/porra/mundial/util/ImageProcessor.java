package com.porra.mundial.util;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

/**
 * Validación y normalización de imágenes subidas por los usuarios (logos de liga y fotos de perfil).
 *
 * <p>No se confía ni en el nombre del archivo ni en el Content-Type declarado por el cliente:
 * se comprueba la firma real del archivo (JPEG o PNG), se leen las dimensiones antes de decodificar
 * (protección frente a "decompression bombs"), se decodifica de verdad y se vuelve a codificar.
 * Al re-codificar se descartan metadatos (EXIF, GPS) y cualquier contenido añadido tras la imagen.
 */
public final class ImageProcessor {

    /** Tamaño máximo del archivo subido. */
    public static final int MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
    /** Máximo de píxeles de la imagen original (~25 MP). */
    public static final long MAX_SOURCE_PIXELS = 25_000_000L;
    /** Lado máximo de la imagen guardada. */
    public static final int MAX_OUTPUT_DIMENSION = 512;

    private static final float JPEG_QUALITY = 0.85f;

    static {
        ImageIO.setUseCache(false);
    }

    private ImageProcessor() {
    }

    /** Resultado de procesar una imagen: bytes normalizados y su tipo MIME. */
    public record ProcessedImage(byte[] data, String contentType) {
    }

    /**
     * Valida y normaliza la imagen.
     *
     * @throws IllegalArgumentException con un mensaje apto para mostrar al usuario si no es válida.
     */
    public static ProcessedImage process(byte[] raw) {
        if (raw == null || raw.length == 0) {
            throw new IllegalArgumentException("El archivo está vacío.");
        }
        if (raw.length > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException("La imagen supera el tamaño máximo de 3 MB.");
        }

        String format = detectFormat(raw);
        if (format == null) {
            throw new IllegalArgumentException("Formato no admitido. Usa una imagen JPG o PNG.");
        }

        BufferedImage source = decode(raw, format);
        BufferedImage scaled = scaleDown(source, format);
        return encode(scaled, format);
    }

    /** Detecta el formato por su firma ("png", "jpeg") o devuelve null si no es ninguno de los admitidos. */
    static String detectFormat(byte[] raw) {
        if (raw.length >= 8
                && (raw[0] & 0xFF) == 0x89 && raw[1] == 'P' && raw[2] == 'N' && raw[3] == 'G'
                && raw[4] == 0x0D && raw[5] == 0x0A && raw[6] == 0x1A && raw[7] == 0x0A) {
            return "png";
        }
        if (raw.length >= 3
                && (raw[0] & 0xFF) == 0xFF && (raw[1] & 0xFF) == 0xD8 && (raw[2] & 0xFF) == 0xFF) {
            return "jpeg";
        }
        return null;
    }

    private static BufferedImage decode(byte[] raw, String format) {
        ImageReader reader = null;
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(raw))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw invalid();
            }
            reader = readers.next();
            if (!reader.getFormatName().equalsIgnoreCase(format)) {
                throw invalid();
            }
            reader.setInput(in, true, true);

            int width = reader.getWidth(0);
            int height = reader.getHeight(0);
            if (width <= 0 || height <= 0 || (long) width * height > MAX_SOURCE_PIXELS) {
                throw new IllegalArgumentException("La imagen es demasiado grande (máximo 25 megapíxeles).");
            }

            BufferedImage image = reader.read(0);
            if (image == null) {
                throw invalid();
            }
            return image;
        } catch (IOException | RuntimeException e) {
            if (e instanceof IllegalArgumentException iae) {
                throw iae;
            }
            throw invalid();
        } finally {
            if (reader != null) {
                reader.dispose();
            }
        }
    }

    private static BufferedImage scaleDown(BufferedImage source, String format) {
        int w = source.getWidth();
        int h = source.getHeight();
        double ratio = Math.min(1.0, (double) MAX_OUTPUT_DIMENSION / Math.max(w, h));
        int targetW = Math.max(1, (int) Math.round(w * ratio));
        int targetH = Math.max(1, (int) Math.round(h * ratio));

        boolean keepAlpha = "png".equals(format) && source.getColorModel().hasAlpha();
        BufferedImage out = new BufferedImage(targetW, targetH,
                keepAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            if (!keepAlpha) {
                g.setColor(Color.WHITE);
                g.fillRect(0, 0, targetW, targetH);
            }
            g.drawImage(source, 0, 0, targetW, targetH, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static ProcessedImage encode(BufferedImage image, String format) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            if ("png".equals(format)) {
                if (!ImageIO.write(image, "png", bytes)) {
                    throw invalid();
                }
                return new ProcessedImage(bytes.toByteArray(), "image/png");
            }

            Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
            if (!writers.hasNext()) {
                throw invalid();
            }
            ImageWriter writer = writers.next();
            try (MemoryCacheImageOutputStream out = new MemoryCacheImageOutputStream(bytes)) {
                ImageWriteParam param = writer.getDefaultWriteParam();
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(JPEG_QUALITY);
                writer.setOutput(out);
                writer.write(null, new IIOImage(image, null, null), param);
            } finally {
                writer.dispose();
            }
            return new ProcessedImage(bytes.toByteArray(), "image/jpeg");
        } catch (IOException e) {
            throw invalid();
        }
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("La imagen no es válida o está dañada. Prueba con otra JPG o PNG.");
    }
}
