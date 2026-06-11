"""Tiny outbound HTTP helpers for channel routers (kept separate for easy mocking)."""

import base64
import json
import urllib.request


def post_json(url: str, payload: dict, headers: dict[str, str] | None = None, timeout: float = 20) -> dict:
    return _send_json("POST", url, payload, headers, timeout)


def patch_json(url: str, payload: dict, headers: dict[str, str] | None = None, timeout: float = 20) -> dict:
    return _send_json("PATCH", url, payload, headers, timeout)


def _send_json(method: str, url: str, payload: dict, headers: dict[str, str] | None, timeout: float) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method=method,
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8")
    return json.loads(body) if body else {}


def get_json(url: str, headers: dict[str, str] | None = None, timeout: float = 20) -> dict:
    request = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def get_data_url(url: str, headers: dict[str, str] | None = None, timeout: float = 30) -> str:
    """Download a binary asset and return it as a base64 data URL."""
    request = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "image/jpeg").split(";")[0]
        data = base64.b64encode(response.read()).decode("ascii")
    return f"data:{content_type};base64,{data}"
