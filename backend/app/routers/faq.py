from pathlib import Path
import re
import logging

from fastapi import APIRouter

from app.config import settings
from app.models.schemas import FaqAnswerResponse, FaqQuestionRequest

router = APIRouter(prefix="/faq", tags=["faq"])
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
FALLBACK_ANSWER = "Try asking about the rehearsal process, schema safety, or how bisection works."
STRICT_SYSTEM_PROMPT = """You answer questions about Migration Rehearsal Agent.

Answer using ONLY the reference material below. Do not use outside knowledge about databases, migrations, or software in general, even if you know it. If the answer requires anything beyond what's in the material provided, say so explicitly instead of filling the gap with general knowledge.

Reference concrete specifics from the material where relevant, including the corruption profile names, demo numbers such as 39.3x or 183 rows, and the actual pipeline stage names. Do not give a vague generic description of a database migration tool. Keep the answer plain-spoken and concise.

REFERENCE MATERIAL:
{context}
"""


def _documentation_context() -> str:
    repo_root = Path(__file__).resolve().parents[3]
    for directory_name in ("docs", "Docs"):
        directory = repo_root / directory_name
        product = directory / "product.md"
        architecture = directory / "architecture.md"
        if product.exists() and architecture.exists():
            return f"{product.read_text(encoding='utf-8')}\n\n{architecture.read_text(encoding='utf-8')}"
    return ""


async def _groq_answer(question: str, history: list[dict[str, str]], context: str) -> str | None:
    if not settings.groq_api_key:
        logger.warning("Groq FAQ call skipped: GROQ_API_KEY is not configured")
        return None
    if not context:
        logger.error("Groq FAQ call skipped: product.md and architecture.md context is empty")
        return None

    system_prompt = STRICT_SYSTEM_PROMPT.format(context=context)
    product_present = "# product.md" in context
    architecture_present = "# architecture.md" in context
    architecture_marker = "\n\n# architecture.md"
    architecture_start = context.find(architecture_marker)
    product_chars = architecture_start if architecture_start >= 0 else len(context)
    architecture_chars = len(context) - architecture_start if architecture_start >= 0 else 0
    logger.warning(
        "Groq FAQ context loaded before API call: product_present=%s architecture_present=%s contains_183=%s contains_39_3=%s product_chars=%d architecture_chars=%d total_chars=%d",
        product_present,
        architecture_present,
        "183" in context,
        "39.3" in context,
        product_chars,
        architecture_chars,
        len(context),
    )
    logger.warning("Groq FAQ full system prompt before API call:\n%s", system_prompt)

    try:
        from groq import AsyncGroq

        client = AsyncGroq(api_key=settings.groq_api_key)
        response = await client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                *[message for turn in history for message in ({"role": "user", "content": turn["question"]}, {"role": "assistant", "content": turn["answer"]})],
                {"role": "user", "content": question},
            ],
            temperature=settings.groq_temperature,
        )
        await client.close()
        answer = (response.choices[0].message.content or "").strip()
        logger.warning(
            "Groq FAQ response received: model=%s temperature=%.2f response_chars=%d",
            settings.groq_model,
            settings.groq_temperature,
            len(answer),
        )
        return answer or None
    except Exception:
        logger.exception("Groq FAQ call failed; using the local docs-grounded fallback")
        return None


def _context_sentence(context: str, terms: set[str]) -> str:
    paragraphs = [paragraph.strip() for paragraph in context.split("\n\n") if paragraph.strip()]
    ranked = sorted(
        paragraphs,
        key=lambda paragraph: len(terms & set(re.findall(r"[a-z]+", paragraph.lower()))),
        reverse=True,
    )
    if not ranked:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", ranked[0].replace("\n", " "))
    matching = next((sentence.strip() for sentence in sentences if terms & set(re.findall(r"[a-z]+", sentence.lower()))), sentences[0].strip())
    cleaned = re.sub(r"^#+\s*", "", matching)
    cleaned = re.sub(r"^\d+(?:\.\d+)*\s+[^.!?]{1,80}\s+(?=[A-Z])", "", cleaned)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _answer_from_context(question: str) -> str:
    context = _documentation_context()
    normalized = question.lower().strip()
    if not normalized:
        return FALLBACK_ANSWER

    if any(term in normalized for term in ("minimal repro", "minimal reproduction", "row count", "smallest subset", "183")):
        if "183" in context:
            return "The documented minimal reproduction ends at 183 rows, after the bisection trail narrows from 500,000 to 61,204, 8,010, 1,140, and finally 183."
        return FALLBACK_ANSWER

    if any(term in normalized for term in ("bisection", "bisect", "delta-debug")):
        fact = _context_sentence(context, {"bisection", "bisects", "delta", "debugging"})
        return f"Bisection narrows a regression by rerunning it against smaller row subsets until the minimal condition remains. {fact}".strip()
    if any(term in normalized for term in ("safe", "security", "production", "schema")):
        fact = _context_sentence(context, {"shadow", "database", "isolated", "production"})
        return f"The rehearsal runs against an isolated, disposable shadow database, so it does not modify production. {fact}".strip()
    if any(term in normalized for term in ("query", "latency", "plan", "performance", "measure")):
        fact = _context_sentence(context, {"latency", "query", "plan", "captures"})
        return f"The query harness runs representative SQL before and after the migration, then compares latency and plans. {fact}".strip()
    if any(term in normalized for term in ("rehearsal", "migration", "work", "run", "data")):
        fact = _context_sentence(context, {"generates", "shadow", "migration", "queries"})
        return f"A rehearsal generates adversarial data, applies the migration in isolation, and checks the real workload. {fact}".strip()
    return FALLBACK_ANSWER


@router.post("/ask", response_model=FaqAnswerResponse)
async def ask_faq(request: FaqQuestionRequest) -> FaqAnswerResponse:
    context = _documentation_context()
    history = [turn.model_dump() for turn in request.history]
    groq_answer = await _groq_answer(request.question, history, context)
    return FaqAnswerResponse(answer=groq_answer or _answer_from_context(request.question))