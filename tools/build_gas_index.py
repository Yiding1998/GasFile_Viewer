#!/usr/bin/env python3
"""Build a searchable index for Garfield gas files.

The parser prefers the Garfield `Identifier:` line because it usually stores
components, fractions, temperature, and pressure independently of file names.
File and directory names are used only as a fallback.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SKIP_NAMES = {
    "gas_index.json",
    "gas_index_report.md",
    "gas_aliases.json",
    "gas_metadata_override.json",
}
SKIP_SUFFIXES = {".md", ".pdf"}
TEXT_READ_LIMIT = 256 * 1024
IDENTIFIER_RE = re.compile(r"^\s*Identifier\s*:\s*(.*?)\s*$", re.IGNORECASE | re.MULTILINE)
TEMP_RE = re.compile(r"\bT\s*=\s*([^,]+?)(?=\s*,\s*p\s*=|\s*$)", re.IGNORECASE)
PRESSURE_RE = re.compile(r"\bp\s*=\s*([^,]+?)\s*$", re.IGNORECASE)
COMPONENT_RE = re.compile(r"^\s*(.+?)\s+([+-]?\d+(?:\.\d+)?)\s*%\s*$")
ATOM_RE = re.compile(r"[A-Za-z][A-Za-z0-9]*")


def rel(path: Path, base: Path) -> str:
    return path.relative_to(base).as_posix()


def load_aliases(path: Path) -> tuple[dict[str, str], list[str]]:
    if not path.exists():
        return {}, []
    data = json.loads(path.read_text(encoding="utf-8"))
    alias_to_canonical: dict[str, str] = {}
    canonical_names: list[str] = []
    for group in data.get("groups", []):
        canonical = group.get("canonical", "").strip()
        if not canonical:
            continue
        canonical_names.append(canonical)
        alias_to_canonical[canonical.lower()] = canonical
        for alias in group.get("aliases", []):
            alias_to_canonical[str(alias).lower()] = canonical
    return alias_to_canonical, sorted(set(canonical_names), key=str.lower)


def normalize_name(name: str, alias_to_canonical: dict[str, str]) -> str:
    cleaned = name.strip().strip('"').strip()
    cleaned = re.sub(r"\s+", "", cleaned)
    return alias_to_canonical.get(cleaned.lower(), cleaned)


def read_prefix(path: Path) -> str:
    raw = path.read_bytes()[:TEXT_READ_LIMIT]
    return raw.decode("utf-8", errors="replace")


def parse_identifier(text: str, alias_to_canonical: dict[str, str]) -> dict[str, Any]:
    match = IDENTIFIER_RE.search(text)
    if not match:
        return {"identifier": "", "components": [], "temperature": "", "pressure": "", "source": ""}

    identifier = match.group(1).strip()
    temperature = ""
    pressure = ""
    temp_match = TEMP_RE.search(identifier)
    if temp_match:
        temperature = temp_match.group(1).strip()
    pressure_match = PRESSURE_RE.search(identifier)
    if pressure_match:
        pressure = pressure_match.group(1).strip()

    composition_text = re.split(r",\s*T\s*=|,\s*p\s*=", identifier, maxsplit=1, flags=re.IGNORECASE)[0]
    components: list[dict[str, Any]] = []
    seen: set[str] = set()
    for part in composition_text.split(","):
        component_match = COMPONENT_RE.match(part)
        if not component_match:
            continue
        name = normalize_name(component_match.group(1), alias_to_canonical)
        if not name or name.lower() in seen:
            continue
        fraction_text = component_match.group(2)
        fraction = float(fraction_text)
        if fraction.is_integer():
            fraction = int(fraction)
        components.append({"name": name, "fraction": fraction})
        seen.add(name.lower())

    return {
        "identifier": identifier,
        "components": components,
        "temperature": temperature,
        "pressure": pressure,
        "source": "identifier" if components else "",
    }


def infer_components_from_path(path_text: str, known_components: list[str], alias_to_canonical: dict[str, str]) -> list[dict[str, Any]]:
    lowered = path_text.lower()
    found: list[str] = []
    for component in sorted(known_components, key=len, reverse=True):
        if re.search(rf"(?<![a-z0-9]){re.escape(component.lower())}(?![a-z0-9])", lowered):
            found.append(component)
    if not found:
        for token in ATOM_RE.findall(path_text):
            normalized = normalize_name(token, alias_to_canonical)
            if normalized in known_components and normalized not in found:
                found.append(normalized)
    return [{"name": name, "fraction": None} for name in sorted(set(found), key=str.lower)]


def parse_path_conditions(path_text: str) -> tuple[str, str]:
    pressure = ""
    temperature = ""
    p_match = re.search(r"(\d+(?:\.\d+)?)\s*atm", path_text, re.IGNORECASE)
    if p_match:
        pressure = f"{p_match.group(1)} atm"
    t_match = re.search(r"(\d+(?:\.\d+)?)\s*c\b", path_text, re.IGNORECASE)
    if t_match:
        temperature = f"{t_match.group(1)} C"
    return pressure, temperature


def aliases_for_components(component_names: list[str], alias_to_canonical: dict[str, str]) -> list[str]:
    component_set = set(component_names)
    aliases: set[str] = set()
    for alias, canonical in alias_to_canonical.items():
        if canonical in component_set and alias.lower() != canonical.lower():
            aliases.add(alias)
    return sorted(aliases, key=str.lower)


def apply_override(record: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(record)
    for key, value in override.items():
        merged[key] = value
    merged["source"] = "manual_override"
    merged["parse_status"] = "ok" if merged.get("components") else "needs_review"
    return merged


def build_index(root: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    gas_root = root / "GasFile"
    alias_path = gas_root / "gas_aliases.json"
    override_path = gas_root / "gas_metadata_override.json"
    alias_to_canonical, known_components = load_aliases(alias_path)
    overrides = json.loads(override_path.read_text(encoding="utf-8")) if override_path.exists() else {}

    records: list[dict[str, Any]] = []
    for path in sorted(gas_root.rglob("*")):
        if not path.is_file():
            continue
        if path.name in SKIP_NAMES or path.suffix.lower() in SKIP_SUFFIXES:
            continue
        path_text = rel(path, root)
        try:
            text = read_prefix(path)
        except OSError as exc:
            records.append({
                "path": path_text,
                "file_name": path.name,
                "directory": rel(path.parent, root),
                "identifier": "",
                "components": [],
                "temperature": "",
                "pressure": "",
                "source": "read_error",
                "parse_status": "error",
                "error": str(exc),
                "size_bytes": path.stat().st_size,
                "search_text": path_text.lower(),
            })
            continue

        parsed = parse_identifier(text, alias_to_canonical)
        components = parsed["components"]
        pressure = parsed["pressure"]
        temperature = parsed["temperature"]
        source = parsed["source"]

        if not components:
            components = infer_components_from_path(path_text, known_components, alias_to_canonical)
            source = "path_fallback" if components else "unparsed"
        if not pressure or not temperature:
            fallback_pressure, fallback_temperature = parse_path_conditions(path_text)
            pressure = pressure or fallback_pressure
            temperature = temperature or fallback_temperature

        parse_status = "ok" if parsed["identifier"] and parsed["components"] else ("fallback" if components else "needs_review")
        component_names = [item["name"] for item in components]
        component_aliases = aliases_for_components(component_names, alias_to_canonical)
        record: dict[str, Any] = {
            "path": path_text,
            "file_name": path.name,
            "directory": rel(path.parent, root),
            "identifier": parsed["identifier"],
            "components": components,
            "component_names": component_names,
            "component_key": " + ".join(component_names),
            "component_aliases": component_aliases,
            "temperature": temperature,
            "pressure": pressure,
            "source": source,
            "parse_status": parse_status,
            "size_bytes": path.stat().st_size,
        }
        if path_text in overrides:
            record = apply_override(record, overrides[path_text])
        record["search_text"] = " ".join([
            record.get("path", ""),
            record.get("identifier", ""),
            record.get("component_key", ""),
            " ".join(record.get("component_aliases", [])),
            record.get("temperature", ""),
            record.get("pressure", ""),
        ]).lower()
        records.append(record)

    component_counter: Counter[str] = Counter()
    status_counter: Counter[str] = Counter()
    for record in records:
        status_counter[record.get("parse_status", "unknown")] += 1
        for name in record.get("component_names", []):
            component_counter[name] += 1

    summary = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "total_files": len(records),
        "status_counts": dict(sorted(status_counter.items())),
        "component_counts": dict(sorted(component_counter.items(), key=lambda item: (-item[1], item[0].lower()))),
    }
    return records, summary


def write_report(path: Path, records: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    lines = [
        "# Gas File Index Report",
        "",
        f"Generated at UTC: `{summary['generated_at_utc']}`",
        "",
        f"Total indexed files: **{summary['total_files']}**",
        "",
        "## Parse Status",
        "",
    ]
    for status, count in summary["status_counts"].items():
        lines.append(f"- `{status}`: {count}")
    lines.extend(["", "## Component Counts", ""])
    for component, count in summary["component_counts"].items():
        lines.append(f"- `{component}`: {count}")
    needs_review = [record for record in records if record.get("parse_status") in {"needs_review", "error"}]
    fallback = [record for record in records if record.get("parse_status") == "fallback"]
    lines.extend(["", "## Needs Review", ""])
    if needs_review:
        for record in needs_review:
            lines.append(f"- `{record['path']}` ({record.get('source', 'unknown')})")
    else:
        lines.append("No files require manual review.")
    lines.extend(["", "## Parsed By Path Fallback", ""])
    if fallback:
        for record in fallback:
            components = ", ".join(record.get("component_names", [])) or "unknown"
            lines.append(f"- `{record['path']}` -> {components}")
    else:
        lines.append("No files required path fallback.")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build GasFile/gas_index.json from Garfield gas files.")
    parser.add_argument("--root", default=".", help="Repository root. Default: current directory.")
    parser.add_argument("--pretty", action="store_true", help="Write indented JSON.")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    records, summary = build_index(root)
    output = {
        "schema_version": 1,
        "summary": summary,
        "files": records,
    }
    index_path = root / "GasFile" / "gas_index.json"
    report_path = root / "GasFile" / "gas_index_report.md"
    index_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2 if args.pretty else None, separators=None if args.pretty else (",", ":")) + "\n",
        encoding="utf-8",
    )
    write_report(report_path, records, summary)
    print(f"Indexed {summary['total_files']} files")
    print(f"Status: {summary['status_counts']}")
    print(f"Wrote {index_path}")
    print(f"Wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
