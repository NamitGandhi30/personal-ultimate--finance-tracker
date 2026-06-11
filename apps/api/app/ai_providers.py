"""Shared LLM access for receipt parsing and transaction categorization.

Provider selection is controlled by the AI_PROVIDER env var:
  - "ollama" | "anthropic" | "gemini" | "openai"  -> use only that provider
  - "off" | "none" | "false"                      -> disable AI features
  - unset / "auto" / "on" / "true"                -> auto-detect from configured
    credentials, tried in order: ollama, anthropic, gemini, openai

Per-provider configuration:
  ollama    OLLAMA_BASE_URL (e.g. https://ollama.com/api for Ollama Cloud),
            OLLAMA_API_KEY, OLLAMA_MODEL (default llava)
  anthropic ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default claude-opus-4-8)
  gemini    GEMINI_API_KEY, GEMINI_MODEL (default gemini-2.5-flash)
  openai    OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL (default gpt-4.1-mini)
"""

import json
import os
import re
import urllib.request

PROVIDER_ORDER = ["ollama", "anthropic", "gemini", "openai"]


def configured_providers() -> list[str]:
    requested = (os.getenv("AI_PROVIDER") or os.getenv("AI_RECEIPT_PROVIDER") or "").strip().lower()
    if requested == "claude":
        requested = "anthropic"
    if requested in PROVIDER_ORDER:
        return [requested]
    if requested in {"off", "none", "false"}:
        return []

    available = {
        "ollama": bool(os.getenv("OLLAMA_API_KEY") or os.getenv("OLLAMA_BASE_URL")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
        "gemini": bool(os.getenv("GEMINI_API_KEY")),
        "openai": bool(os.getenv("OPENAI_API_KEY")),
    }
    return [provider for provider in PROVIDER_ORDER if available[provider]]


def generate(
    prompt: str,
    image_base64: str | None = None,
    providers: list[str] | None = None,
    timeout: float = 25,
) -> tuple[str | None, str | None, list[str]]:
    """Run the prompt through the first working provider.

    Returns (content, provider, warnings). Content is None when every provider
    failed or none is configured.
    """
    warnings: list[str] = []
    for provider in providers if providers is not None else configured_providers():
        try:
            caller = _CALLERS[provider]
            content = caller(prompt, image_base64, timeout)
            if content and content.strip():
                return content, provider, warnings
            warnings.append(f"AI provider ({provider}) returned an empty response.")
        except Exception as exc:
            message = str(exc).strip() or exc.__class__.__name__
            warnings.append(f"AI provider ({provider}) failed: {message}")
    return None, None, warnings


def _call_anthropic(prompt: str, image_base64: str | None, timeout: float) -> str:
    import anthropic

    client = anthropic.Anthropic(timeout=timeout)
    content: list[dict] = []
    if image_base64:
        media_type, data = _split_data_url(image_base64)
        content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}})
    content.append({"type": "text", "text": prompt})

    response = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8"),
        max_tokens=1024,
        messages=[{"role": "user", "content": content}],
    )
    return "".join(block.text for block in response.content if block.type == "text")


def _call_ollama(prompt: str, image_base64: str | None, timeout: float) -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", os.getenv("OLLAMA_RECEIPT_MODEL", "llava"))
    headers = {"Content-Type": "application/json"}
    api_key = os.getenv("OLLAMA_API_KEY", "")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload: dict = {"model": model, "prompt": prompt, "stream": False, "format": "json"}
    if image_base64:
        payload["images"] = [_split_data_url(image_base64)[1]]

    response = _post_json(f"{base_url}/generate", payload, headers, timeout)
    return str(response.get("response") or _deep_find_text(response))


def _call_gemini(prompt: str, image_base64: str | None, timeout: float) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    parts: list[dict] = [{"text": prompt}]
    if image_base64:
        mime_type, data = _split_data_url(image_base64)
        parts.insert(0, {"inline_data": {"mime_type": mime_type, "data": data}})

    model = os.getenv("GEMINI_MODEL", os.getenv("GEMINI_RECEIPT_MODEL", "gemini-2.5-flash"))
    response = _post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        {"contents": [{"parts": parts}]},
        {"Content-Type": "application/json"},
        timeout,
    )
    return str(_deep_find_text(response))


def _call_openai(prompt: str, image_base64: str | None, timeout: float) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")

    content: list[dict] = [{"type": "input_text", "text": prompt}]
    if image_base64:
        content.append({"type": "input_image", "image_url": image_base64, "detail": "high"})

    payload = {
        "model": os.getenv("OPENAI_MODEL", os.getenv("OPENAI_RECEIPT_MODEL", "gpt-4.1-mini")),
        "input": [{"role": "user", "content": content}],
    }
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    response = _post_json(
        f"{base_url}/responses",
        payload,
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout,
    )
    return str(response.get("output_text") or _deep_find_text(response))


_CALLERS = {
    "ollama": _call_ollama,
    "anthropic": _call_anthropic,
    "gemini": _call_gemini,
    "openai": _call_openai,
}


def _post_json(url: str, payload: dict, headers: dict[str, str], timeout: float) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _split_data_url(value: str) -> tuple[str, str]:
    if value.startswith("data:") and "," in value:
        metadata, data = value.split(",", 1)
        mime_match = re.match(r"data:([^;]+)", metadata)
        return (mime_match.group(1) if mime_match else "image/jpeg", data)
    return "image/jpeg", value


def _deep_find_text(value: object) -> str:
    if isinstance(value, dict):
        if isinstance(value.get("text"), str):
            return value["text"]
        return " ".join(_deep_find_text(item) for item in value.values()).strip()
    if isinstance(value, list):
        return " ".join(_deep_find_text(item) for item in value).strip()
    return ""
