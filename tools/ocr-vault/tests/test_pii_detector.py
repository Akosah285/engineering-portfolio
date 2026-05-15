"""TDD: PII detector — names of group members / TAs / instructors in OCR'd text.

Surfaces PII (mostly person names) so the curator can review before
publishing. False positives are acceptable; false negatives are not.

Public surface (kept narrow on purpose):
- detect_pii(text, owner_name) -> PiiReport
- PiiReport with names_detected, akwasi_present (owner_present), needs_redaction_review

A name is detected by combining:
1. Heuristic: capitalised bigrams that look like Western person-names ("First Last"),
   excluding a stoplist of place / institution / common-noun bigrams.
2. The owner_name is matched as a whole multi-token name (case-insensitive),
   independent of the bigram heuristic, including lone-first-name matches.

Inputs are short enough (a single OCR'd page worth of prose) that we keep
the implementation straightforward and well-tested rather than fast.
"""

import pytest

from ocr_vault.pii_detector import PiiReport, detect_pii


# ----- shape -----


def test_returns_pii_report_with_three_fields() -> None:
    report = detect_pii("hello", owner_name="Akwasi Akosah")
    assert isinstance(report, PiiReport)
    assert isinstance(report.names_detected, list)
    assert isinstance(report.owner_present, bool)
    assert isinstance(report.needs_redaction_review, bool)


def test_empty_text_yields_empty_report() -> None:
    report = detect_pii("", owner_name="Akwasi Akosah")
    assert report.names_detected == []
    assert report.owner_present is False
    assert report.needs_redaction_review is False


# ----- owner detection -----


def test_owner_full_name_detected() -> None:
    report = detect_pii(
        "Submitted by Akwasi Akosah for ENGS 31.", owner_name="Akwasi Akosah"
    )
    assert report.owner_present is True


def test_owner_first_name_alone_detected() -> None:
    """Akwasi works alone — first name is enough to flag as 'owner present'."""
    report = detect_pii("Akwasi worked on the lab.", owner_name="Akwasi Akosah")
    assert report.owner_present is True


def test_owner_case_insensitive() -> None:
    report = detect_pii("AKWASI AKOSAH did the work.", owner_name="Akwasi Akosah")
    assert report.owner_present is True


def test_owner_absent_not_flagged() -> None:
    report = detect_pii("This is generic prose.", owner_name="Akwasi Akosah")
    assert report.owner_present is False


def test_owner_does_not_appear_in_names_detected() -> None:
    """The owner is whitelisted; only OTHER names go in names_detected."""
    report = detect_pii(
        "Akwasi Akosah and John Smith worked on this.",
        owner_name="Akwasi Akosah",
    )
    assert "Akwasi Akosah" not in report.names_detected
    assert "John Smith" in report.names_detected


# ----- non-owner detection -----


def test_detects_simple_first_last_bigram() -> None:
    report = detect_pii("Worked with Jane Doe on the project.", owner_name="Akwasi Akosah")
    assert "Jane Doe" in report.names_detected


def test_detects_multiple_names() -> None:
    text = "Group: Jane Doe, John Smith, and Mary Williams handled the analysis."
    report = detect_pii(text, owner_name="Akwasi Akosah")
    for name in ("Jane Doe", "John Smith", "Mary Williams"):
        assert name in report.names_detected


def test_deduplicates_repeated_names() -> None:
    text = "Jane Doe wrote it. Then Jane Doe revised. Jane Doe submitted."
    report = detect_pii(text, owner_name="Akwasi Akosah")
    assert report.names_detected.count("Jane Doe") == 1


def test_ignores_sentence_initial_words() -> None:
    """A capitalised bigram like 'The Apple' at sentence start is not a person."""
    text = "The Apple fell. The Boy ran."
    report = detect_pii(text, owner_name="Akwasi Akosah")
    assert report.names_detected == []


def test_ignores_known_non_person_capitals() -> None:
    """Stoplist: places, institutions, common phrases that look like names."""
    text = "We met at New York to study at Dartmouth College."
    report = detect_pii(text, owner_name="Akwasi Akosah")
    assert "New York" not in report.names_detected
    assert "Dartmouth College" not in report.names_detected


def test_ignores_titles_glued_to_names_keeps_name_only() -> None:
    """Title prefixes like 'Dr.' / 'Prof.' shouldn't break name detection."""
    text = "Office hours with Dr. Jane Smith were helpful."
    report = detect_pii(text, owner_name="Akwasi Akosah")
    assert "Jane Smith" in report.names_detected


# ----- needs_redaction_review -----


def test_needs_review_true_when_non_owner_names_present() -> None:
    report = detect_pii("Worked with John Smith.", owner_name="Akwasi Akosah")
    assert report.needs_redaction_review is True


def test_needs_review_false_when_only_owner_present() -> None:
    """Owner presence alone doesn't require review (it's the wordmark)."""
    report = detect_pii("Akwasi Akosah submitted this.", owner_name="Akwasi Akosah")
    assert report.needs_redaction_review is False


def test_needs_review_false_when_no_names_and_no_owner() -> None:
    report = detect_pii("Pure technical content.", owner_name="Akwasi Akosah")
    assert report.needs_redaction_review is False


# ----- robustness -----


@pytest.mark.parametrize(
    "noisy_text",
    [
        "  multiple   spaces   between   words  ",
        "punctuation, John Smith. More.",
        "newlines\nJohn Smith\nmore",
        "John Smith\tand\ttabs",
    ],
)
def test_robust_to_whitespace_and_punctuation(noisy_text: str) -> None:
    report = detect_pii(noisy_text, owner_name="Akwasi Akosah")
    if "John Smith" in noisy_text:
        assert "John Smith" in report.names_detected


def test_does_not_flag_lone_capitalised_word() -> None:
    """A single capitalised word ('Monday') is not a name."""
    report = detect_pii("Submitted Monday.", owner_name="Akwasi Akosah")
    assert report.names_detected == []
