"""Tests for pythonai speech metrics (pure functions, no I/O)."""

from speech_metrics import (
    count_fillers,
    count_words,
    filler_density,
    fluency_score,
    words_per_minute,
)


class TestCountWords:
    def test_empty(self):
        assert count_words("") == 0

    def test_simple(self):
        assert count_words("hello world") == 2


class TestCountFillers:
    def test_single_words_with_punctuation(self):
        text = "Um, I have five years of experience. Like, I worked on systems."
        assert count_fillers(text) == 2

    def test_multi_word_phrases(self):
        text = "you know, it was quite hard, you know, to scale"
        assert count_fillers(text) == 2

    def test_case_insensitive(self):
        assert count_fillers("Um Actually Like") == 3

    def test_no_fillers(self):
        assert count_fillers("I led a team of four engineers.") == 0


class TestFillerDensity:
    def test_zero_words(self):
        assert filler_density("") == 0.0

    def test_known_density(self):
        text = "Um, I have five years of experience. Like, I worked on scaling systems, you know, and basically led a team of four."
        # 4 fillers / 22 words = 18.18%
        assert filler_density(text) == 18.18


class TestWordsPerMinute:
    def test_too_short_duration(self):
        assert words_per_minute("hello world", 0) is None
        assert words_per_minute("hello world", 0.5) is None

    def test_known_wpm(self):
        assert words_per_minute("one two three four five", 15) == 20.0

    def test_no_words(self):
        assert words_per_minute("", 60) is None


class TestFluencyScore:
    def test_empty(self):
        assert fluency_score("") == 0.0

    def test_clean_long_answer_is_fluent(self):
        text = "I led a team of four engineers building a payments platform."
        assert fluency_score(text) == 1.0

    def test_clipped_answer_penalized(self):
        assert fluency_score("Yes.") < 1.0

    def test_heavy_fillers_penalized(self):
        text = "um like you know um like um"
        assert fluency_score(text) < 0.5

    def test_bounds(self):
        assert 0.0 <= fluency_score("anything") <= 1.0
