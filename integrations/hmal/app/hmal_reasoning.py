"""HMAL-only choices supported by the pinned HOME native templates."""

OPTIONS = {
    "qwen3.8": (("off", "Brez razmišljanja · hitro"), ("low", "Nizko"), ("medium", "Srednje"), ("xhigh", "Zelo visoko")),
    "gpt-oss": (("low", "Nizko"), ("medium", "Srednje"), ("high", "Visoko")),
    "gemma4": (("off", "Izključeno"), ("on", "Vključeno")),
    "gemma4-q5": (("off", "Izključeno"), ("on", "Vključeno")),
    "mellum2.1": (("off", "Izključeno"), ("on", "Vključeno")),
}


def capability(key, profile=None):
    choices = OPTIONS.get(key, ())
    effort = (profile or {}).get("reasoning_effort")
    default = "Privzeto (profil)" if not effort or effort == "native" else f"Privzeto ({effort})"
    return {"options": [{"value": "default", "label": default}] +
            [{"value": value, "label": label} for value, label in choices],
            "hint": "Velja za ta HMAL pogovor. Nižje razmišljanje lahko skrajša čakanje." if choices else
                    "Nativno razmišljanje; ta model nima podprtih stopenj ali stikala."}


def choice(key, value):
    if not isinstance(value, str) or value not in {"default", *(v for v, _ in OPTIONS.get(key, ()))}:
        raise ValueError("Izbrana stopnja razmišljanja za ta model ni podprta.")
    return value


def validate(value, models):
    if not isinstance(value, dict) or any(key not in models for key in value):
        raise ValueError("Nastavitve razmišljanja niso veljavne.")
    return {key: choice(key, value.get(key, "default")) for key in models}
