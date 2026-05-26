from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum
import json
import instructor
from concurrent.futures import ThreadPoolExecutor


# Models
class Polarity(str, Enum):
    positive = "positive"
    negative = "negative"


class AmendmentType(str, Enum):
    addition = "addition"
    modification = "modification"
    removal = "removal"
    suggestion = "suggestion"


class Argument(BaseModel):
    label: str = Field(description="Short summary of the argument (max 20 words)")
    polarity: Polarity = Field(description="Whether the argument supports or opposes the position")


class Position(BaseModel):
    label: str = Field(description="Short summary of a single proposal or stance (max 20 words)")
    amendment_type: Optional[AmendmentType] = Field(default=None, description="Type of amendment proposed")
    arguments: List[Argument] = Field(default_factory=list, description="Arguments supporting or opposing the position")


class Positions(BaseModel):
    positions: List[Position] = Field(description="All distinct positions extracted from the comment")


# LLM Config

_SYSTEM_PROMPT = (
    "You are an expert in argument mining. "
    "Your task is to extract positions and arguments from a public consultation comment "
    "using the IBIS (Issue-Based Information System) model."
)


def _user_prompt(comment: str) -> str:
    return f"""
**IBIS structure**
- Issue: the policy question under discussion.
- Position: a proposal, amendment, recommendation, or stance responding to the issue.
- Argument: a reason supporting or opposing a position.
**Context**
The comments come from a legislative consultation about a draft law article.
Comments often propose:
- additions to the law
- removals from the law
- modifications to the law
- general policy suggestions
These proposals correspond to IBIS Positions.
Definitions
Issue in this task
The issue is predefined and corresponds to the article under consultation.
**Issue**:
"What changes, if any, should be made to Article X?"
Positions correspond to proposed amendments or suggestions related to the article.
All extracted positions must respond to this issue.
The model should NOT generate or modify the issue.
**Position**
A Position is a distinct proposal or amendment expressed in the comment.
**Typical positions include**:
- adding a paragraph or provision
- removing a paragraph or provision
- modifying an existing rule
- introducing a new policy suggestion
**Rules for Positions**:
- Each position must represent ONE proposal only.
- Use a short descriptive label (max 20 words).
- Preserve the meaning of the comment without adding interpretation.
- If the comment contains multiple proposals, extract multiple positions.
**Argument**
An Argument is a reason explaining why the position should or should not be accepted.
**Rules for Arguments**:
- Arguments must justify or oppose a position.
- Arguments must not contain new proposals.
- Arguments must be derived strictly from the text.
- Use a short descriptive label (max 20 words).
**Argument polarity**
- positive → supports the position
- negative → criticizes or challenges the position
**Extraction rules**
1. Extract all distinct positions mentioned in the comment.
2. Each position must contain exactly one idea.
3. Attach arguments to the position they refer to.
4. Do NOT invent positions or arguments.
5. If the comment only contains justification without a proposal, return no positions.
6. If multiple proposals exist, create multiple positions.
7. If no positions exist, return an empty list.
**Language rule**
All labels MUST be written in the same language as the comment.
**Output rules**
Return ONLY the structured output.
Do NOT include explanations, markdown, or additional text.
**Reasoning process**
Before producing the final output:
1. Identify explicit proposals or amendment suggestions.
2. Convert each proposal into a Position label.
3. Identify sentences that justify the proposal.
4. Convert them into Argument labels.
5. Attach arguments to the correct position.
**Comment**
{comment}
"""


def _build_client(pipe: str, url: str):
    return instructor.from_provider(
        f"ollama/{pipe}",
        base_url=f"{url}/v1",
        mode=instructor.Mode.JSON,
    )


def _extract_one(client, pipe: str, comment_text: str) -> Optional[Positions]:
    """Εκτελεί την εξαγωγή για ένα κείμενο και επιστρέφει Positions object."""
    try:
        response: Positions = client.create(
            model=pipe,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _user_prompt(comment_text)},
            ],
            response_model=Positions,
        )
        return response
    except Exception as e:
        print(f"[information_extr] Extraction failed: {e}")
        return None


# --- Public API ---

def information_extr_ol(comments: list[dict], pipe: str, url: str) -> str:
    """Αναλύει πολλά σχόλια και τα ενώνει σε ένα ενιαίο Positions JSON."""
    all_extracted_positions = []
    print("before information_extr_ol comments", flush=True)

    def _process_comment(comment):
        thread_client = _build_client(pipe, url)
        print(f"Inside information_extr_ol, comment: {str(comment)[:80]}", flush=True)
        text = _get_comment_text(comment)
        if not text:
            return []
        extracted = _extract_one(thread_client, pipe, text)
        return extracted.positions if extracted else []

    with ThreadPoolExecutor(max_workers=9) as executor:
        results = list(executor.map(_process_comment, comments))

    for positions in results:
        all_extracted_positions.extend(positions)

    final_output = Positions(positions=all_extracted_positions)
    return final_output.model_dump_json(indent=4)


def information_extr_single(comment: dict, pipe: str, url: str) -> str:
    """Αναλύει ένα σχόλιο και επιστρέφει το Positions JSON."""
    client = _build_client(pipe, url)
    text = _get_comment_text(comment)
    result = _extract_one(client, pipe, text) if text else None

    if result:
        return result.model_dump_json(indent=4)
    return json.dumps({"positions": []})


def _get_comment_text(comment: dict) -> str:
    if isinstance(comment, str): return comment.strip()
    for key in ("content", "text", "comment", "body"):
        val = comment.get(key)
        if val and isinstance(val, str): return val.strip()
    for val in comment.values():
        if isinstance(val, str) and val.strip(): return val.strip()
    return ""