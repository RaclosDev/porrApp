package app.porrapp.service.league;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class PokerMusicLinkTest {

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource(nullValues = "NULL", value = {
            "https://youtu.be/dQw4w9WgXcQ, dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s, dQw4w9WgXcQ",
            "https://m.youtube.com/watch?list=abc&v=dQw4w9WgXcQ, dQw4w9WgXcQ",
            "https://youtube.com/shorts/dQw4w9WgXcQ/, dQw4w9WgXcQ",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ, dQw4w9WgXcQ",
            "pon esta https://youtu.be/dQw4w9WgXcQ porfa, dQw4w9WgXcQ",
            "https://youtu.be/corto, NULL",
            "https://evil.com/watch?v=dQw4w9WgXcQ, NULL",
            "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ, NULL",
            "despacito luis fonsi, NULL",
    })
    void extractsTheVideoIdOnlyFromYoutubeLinks(String text, String expected) {
        assertThat(PokerMusicService.videoIdFromLink(text)).isEqualTo(expected);
    }
}
