"""PII (person-name) detector for OCR'd page text.

Surfaces names of group members / TAs / instructors so the curator can
review before any thumbnail or featured-problem from that page goes live.
False positives are fine; false negatives are not.

Public surface:
- PiiReport: result dataclass
- detect_pii(text, owner_name) -> PiiReport
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Words that often appear capitalised but are not person names.
# This is a stoplist for the second token of a "First Last" bigram OR for
# either token. It's intentionally narrow — false positives are acceptable.
_NON_PERSON_WORDS: frozenset[str] = frozenset(
    {
        # institutions / places (extend organically)
        "York",
        "California",
        "England",
        "America",
        "Boston",
        "Hanover",
        "College",
        "University",
        "School",
        "Engineering",
        "Department",
        "Hall",
        "Library",
        "Building",
        "Room",
        # title-case calendar / common bigrams
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    }
)

# Common sentence-initial words that, when followed by another capital,
# generate noise like "The Apple". Used to skip the first capitalised
# token at the start of a sentence.
_SENTENCE_INITIAL_NOISE: frozenset[str] = frozenset(
    {"The", "A", "An", "This", "That", "These", "Those", "It", "He", "She", "We", "They", "I"}
)

# Title prefixes glued to names ("Dr. Jane Smith") — strip the period so
# tokenization doesn't break across the punctuation boundary.
_TITLE_PERIOD_RE = re.compile(r"\b(Dr|Prof|Mr|Mrs|Ms|Mx)\.")

_TITLES: frozenset[str] = frozenset(
    {"Dr", "Prof", "Professor", "Mr", "Mrs", "Ms", "Mx"}
)

# Token = a capitalised word (Unicode-aware enough for ASCII names; OCR
# output is ASCII-dominant for our coursework corpus).
_TOKEN_RE = re.compile(r"[A-Z][a-z]+")

# Split into "atoms" of consecutive letters and whitespace — punctuation
# breaks adjacency. So "Jane Doe, John Smith" becomes two atoms.
_ATOM_SPLIT_RE = re.compile(r"[^A-Za-z\s]+")


@dataclass(frozen=True, slots=True)
class PiiReport:
    """PII findings for a single page's text.

    Attributes:
        names_detected: Person-names found in the text, deduped & ordered as
            first-seen. Excludes the owner.
        owner_present: Whether the owner_name (or its first name alone)
            appears in the text.
        needs_redaction_review: True iff names_detected is non-empty.
    """

    names_detected: list[str] = field(default_factory=list)
    owner_present: bool = False
    needs_redaction_review: bool = False


def _looks_like_person_token(tok: str) -> bool:
    """A token is name-shaped if it's CapitalisedLowercase and not in stoplist."""
    if not tok:
        return False
    if tok in _NON_PERSON_WORDS:
        return False
    return bool(_TOKEN_RE.fullmatch(tok))


def _scan_owner(text: str, owner_name: str) -> bool:
    """Owner present if full name OR lone first name appears (case-insensitive)."""
    if not owner_name.strip():
        return False
    norm = text.lower()
    full = owner_name.lower()
    if full in norm:
        return True
    first = owner_name.split()[0].lower()
    # Word-boundary check on the lone first name to avoid substring hits.
    return re.search(rf"\b{re.escape(first)}\b", norm) is not None


def _scan_other_names(text: str, owner_name: str) -> list[str]:
    """Find capitalised bigrams that look like person names, excluding owner."""
    owner_lower = owner_name.lower()
    owner_first_lower = owner_name.split()[0].lower() if owner_name.strip() else ""

    # Strip the period off recognized titles so tokenization doesn't break
    # across "Dr." -> ["Dr", "."].
    text = _TITLE_PERIOD_RE.sub(r"\1", text)

    found: list[str] = []
    seen: set[str] = set()

    # Split into atoms on punctuation. Inside an atom, only whitespace
    # separates tokens — so a bigram match really is two adjacent words.
    atoms = _ATOM_SPLIT_RE.split(text)
    for atom in atoms:
        tokens = atom.split()
        if not tokens:
            continue

        # Skip a sentence-initial common-noise capitalised word ("The Apple").
        start = 1 if tokens[0] in _SENTENCE_INITIAL_NOISE else 0

        i = start
        while i < len(tokens) - 1:
            tok = tokens[i]

            # Title prefix ("Dr Jane Smith") — name is at i+1, i+2.
            if tok in _TITLES and i + 2 < len(tokens):
                cand_first = tokens[i + 1]
                cand_last = tokens[i + 2]
                if _looks_like_person_token(cand_first) and _looks_like_person_token(
                    cand_last
                ):
                    name = f"{cand_first} {cand_last}"
                    if name.lower() != owner_lower and name not in seen:
                        seen.add(name)
                        found.append(name)
                    i += 3
                    continue

            cand_first = tokens[i]
            cand_last = tokens[i + 1]

            if _looks_like_person_token(cand_first) and _looks_like_person_token(
                cand_last
            ):
                name = f"{cand_first} {cand_last}"
                if (
                    name.lower() != owner_lower
                    and cand_first.lower() != owner_first_lower
                    and name not in seen
                ):
                    seen.add(name)
                    found.append(name)
                i += 2
                continue

            i += 1

    return found


def detect_pii(text: str, *, owner_name: str) -> PiiReport:
    """Scan text for person-names and the owner's presence.

    Args:
        text: A single page's OCR'd prose.
        owner_name: The portfolio owner's full name (e.g., "Akwasi Akosah").
            Owner detection matches both the full name and lone first name.

    Returns:
        PiiReport with names_detected (excludes owner), owner_present,
        needs_redaction_review (True iff non-owner names were found).
    """
    if not text:
        return PiiReport()
    names = _scan_other_names(text, owner_name)
    owner_present = _scan_owner(text, owner_name)
    return PiiReport(
        names_detected=names,
        owner_present=owner_present,
        needs_redaction_review=len(names) > 0,
    )
