"""
modules/fact_checking.py

Χρησιμοποιεί τα μοντέλα που φορτώνονται στο lifespan του main.py (_models dict).
ΔΕΝ φορτώνει μοντέλα μόνο του.
"""

from ddgs import DDGS
from deep_translator import GoogleTranslator
from langdetect import detect
import torch
import torch.nn.functional as F

# Ρυθμίσεις
MAX_INPUT_LENGTH  = 1024
MAX_OUTPUT_LENGTH = 128
NUM_SNIPPETS      = 5


# Βοηθητικές συναρτήσεις
def translate_to_english(text: str) -> tuple[str, bool]:
    """Μεταφράζει σε αγγλικά αν χρειάζεται."""
    try:
        lang = detect(text)
        if lang == "en":
            return text, False
        translated = GoogleTranslator(source="auto", target="en").translate(text)
        return translated, True
    except Exception:
        return text, False


def is_english(text: str) -> bool:
    """Ελέγχει αν το κείμενο είναι αγγλικά (ASCII)."""
    try:
        text.encode("ascii")
        return True
    except UnicodeEncodeError:
        return False


def fetch_web_snippets(claim_en: str, num_results: int = NUM_SNIPPETS) -> list[dict]:
    """Αναζητά fact-check snippets από DuckDuckGo."""
    query = f"fact check {claim_en}"
    try:
        with DDGS() as ddgs:
            raw_results = list(ddgs.text(query, max_results=num_results * 3, region="wt-wt"))

        filtered = []
        for r in raw_results:
            body  = r.get("body", "")
            title = r.get("title", "")
            if is_english(body) and is_english(title) and len(body) > 50:
                filtered.append(r)
            if len(filtered) >= num_results:
                break
        return filtered
    except Exception as e:
        print(f"⚠️  Web search error: {e}")
        return []


def build_evidence_from_snippets(snippets: list[dict]) -> str:
    """Συνδυάζει τα snippets σε ένα evidence string."""
    parts = []
    for i, snippet in enumerate(snippets, 1):
        title = snippet.get("title", "").strip()
        body  = snippet.get("body", "").strip()
        if body:
            parts.append(f"[{i}] {title}: {body}")
    return " ".join(parts)


def get_verdict(claim: str, evidence: str, nli_model, nli_tokenizer) -> tuple[str, str, float]:
    """NLI verdict: TRUE / FALSE / UNVERIFIABLE."""
    inputs = nli_tokenizer(
        evidence, claim,
        return_tensors="pt",
        truncation=True,
        max_length=512,
    )
    with torch.no_grad():
        logits = nli_model(**inputs).logits
    probs = F.softmax(logits, dim=-1)[0]

    # cross-encoder/nli label order: CONTRADICTION=0, ENTAILMENT=1, NEUTRAL=2
    label_map = {0: ("FALSE", "❌"), 1: ("TRUE", "✅"), 2: ("UNVERIFIABLE", "⚠️")}
    idx        = probs.argmax().item()
    label, icon = label_map[idx]
    confidence  = round(probs[idx].item(), 4)
    return label, icon, confidence


def generate_explanation(claim: str, evidence: str, model, tokenizer, device: str) -> str:
    """T5 explanation generation."""
    input_text = f"summarize: {claim.strip()} \n {evidence.strip()}"
    inputs = tokenizer(
        input_text,
        return_tensors="pt",
        max_length=MAX_INPUT_LENGTH,
        truncation=True,
        padding="longest",
    ).to(device)

    with torch.no_grad():
        output_ids = model.generate(
            inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            max_length=MAX_OUTPUT_LENGTH,
            num_beams=4,
            length_penalty=2.0,
            early_stopping=True,
        )
    return tokenizer.decode(output_ids[0], skip_special_tokens=True)


def fact_checker(
    comment: str,
    models: dict,                   # το _models dict από το main.py
) -> tuple[str, str, str, float, list[dict]]:
    """
    Ελέγχει ένα claim και επιστρέφει:
        verdict_label, verdict_icon, explanation, confidence, snippets

    Παράμετροι:
        comment : το κείμενο/claim του χρήστη
        models  : το _models dict που φορτώνεται στο lifespan του main.py
    """
    claim_en, _ = translate_to_english(comment)

    snippets = fetch_web_snippets(claim_en)
    if not snippets:
        raise ValueError("Δεν βρέθηκαν σχετικά snippets για το claim.")

    evidence = build_evidence_from_snippets(snippets)

    verdict_label, verdict_icon, confidence = get_verdict(
        claim_en, evidence,
        models["nli"],
        models["nli_tokenizer"],
    )

    explanation = generate_explanation(
        claim_en, evidence,
        models["t5"],
        models["t5_tokenizer"],
        models["device"],
    )

    return verdict_label, verdict_icon, explanation, confidence, snippets