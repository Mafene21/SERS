"""Create the local public-client config from the dashboard's Supabase settings."""

from __future__ import annotations

import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env.local"
OUTPUT_FILE = Path(__file__).resolve().parents[1] / "web" / "config.local.js"


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


def main() -> None:
    env = read_env_file(ENV_FILE)
    url = os.environ.get(
        "NEXT_PUBLIC_SUPABASE_URL", env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    ).rstrip("/")
    key = os.environ.get(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""),
    )
    if not url or not key:
        raise SystemExit(
            "Add NEXT_PUBLIC_SUPABASE_URL and "
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the repository .env.local first."
        )
    config = {"supabaseUrl": url, "publishableKey": key}
    OUTPUT_FILE.write_text(
        "window.SERS_CONFIG = " + json.dumps(config) + ";\n", encoding="utf-8"
    )
    print("Created citizen-app/web/config.local.js (ignored by Git).")


if __name__ == "__main__":
    main()
