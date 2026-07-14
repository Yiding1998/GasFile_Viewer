#!/usr/bin/env python3
"""Build a searchable, validated index for Garfield gas files.

The parser prefers the Garfield `Identifier:` line because it usually stores
components, fractions, temperature, and pressure independently of file names.
File and directory names are used only as a fallback.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 2
ATM_IN_PA = 101_325.0
COMPOSITION_SUM_TOLERANCE = 0.05
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
QUANTITY_RE = re.compile(
    r"^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([^\d\s]*)\s*$"
)
PATH_PRESSURE_RE = re.compile(
    r"([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(atm|bar|mbar|kpa|mpa|pa|torr|mmhg)\b",
    re.IGNORECASE,
)
PATH_TEMPERATURE_RE = re.compile(
    r"([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(k|c|degc|celsius)\b",
    re.IGNORECASE,
)
PRESSURE_FACTORS_PA = {
    "pa": 1.0,
    "kpa": 1_000.0,
    "mpa": 1_000_000.0,
    "bar": 100_000.0,
    "mbar": 100.0,
    "atm": ATM_IN_PA,
    "torr": ATM_IN_PA / 760.0,
    "mmhg": 133.322387415,
}


def rel(path: Path, base: Path) -> str:
    return path.relative_to(base).as_posix()


def compact_number(value: float) -> int | float:
    if math.isclose(value, round(value), abs_tol=1e-12):
        return int(round(value))
    return float(f"{value:.12g}")


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


def read_text_and_hash(path: Path) -> tuple[str, str]:
    digest = hashlib.sha256()
    prefix = bytearray()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
            if len(prefix) < TEXT_READ_LIMIT:
                prefix.extend(chunk[: TEXT_READ_LIMIT - len(prefix)])
    return bytes(prefix).decode("utf-8", errors="replace"), digest.hexdigest()


def parse_temperature_k(value: str) -> int | float | None:
    match = QUANTITY_RE.match(value or "")
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2).replace(chr(176), "").lower().rstrip(".")
    if unit in {"", "k", "kelvin"}:
        result = number
    elif unit in {"c", "degc", "celsius"}:
        result = number + 273.15
    elif unit in {"f", "degf", "fahrenheit"}:
        result = (number - 32.0) * 5.0 / 9.0 + 273.15
    else:
        return None
    if not math.isfinite(result) or result <= 0:
        return None
    return compact_number(result)


def parse_pressure_pa(value: str) -> int | float | None:
    match = QUANTITY_RE.match(value or "")
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2).lower().rstrip(".")
    factor = PRESSURE_FACTORS_PA.get(unit)
    if factor is None:
        return None
    result = number * factor
    if not math.isfinite(result) or result <= 0:
        return None
    return compact_number(result)


def parse_identifier(text: str, alias_to_canonical: dict[str, str]) -> dict[str, Any]:
    match = IDENTIFIER_RE.search(text)
    if not match:
        return {"identifier": "", "components": [], "temperature": "", "pressure": "", "source": ""}
    identifier = match.group(1).strip()
    temp_match = TEMP_RE.search(identifier)
    pressure_match = PRESSURE_RE.search(identifier)
    temperature = temp_match.group(1).strip() if temp_match else ""
    pressure = pressure_match.group(1).strip() if pressure_match else ""

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
        components.append({
            "name": name,
            "fraction": compact_number(float(component_match.group(2))),
        })
        seen.add(name.lower())
    return {
        "identifier": identifier,
        "components": components,
        "temperature": temperature,
        "pressure": pressure,
        "source": "identifier" if components else "",
    }


def infer_components_from_path(
    path_text: str,
    known_components: list[str],
    alias_to_canonical: dict[str, str],
) -> list[dict[str, Any]]:
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
    pressure_match = PATH_PRESSURE_RE.search(path_text)
    temperature_match = PATH_TEMPERATURE_RE.search(path_text)
    pressure = (
        f"{pressure_match.group(1)} {pressure_match.group(2)}" if pressure_match else ""
    )
    temperature = (
        f"{temperature_match.group(1)} {temperature_match.group(2)}"
        if temperature_match
        else ""
    )
    return pressure, temperature


def aliases_for_components(
    component_names: list[str],
    alias_to_canonical: dict[str, str],
) -> list[str]:
    component_set = set(component_names)
    aliases = {
        alias
        for alias, canonical in alias_to_canonical.items()
        if canonical in component_set and alias.lower() != canonical.lower()
    }
    return sorted(aliases, key=str.lower)


def apply_override(record: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(record)
    merged.update(override)
    merged["source"] = "manual_override"
    return merged


def normalize_components(
    components: list[dict[str, Any]],
    alias_to_canonical: dict[str, str],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in components:
        name = normalize_name(str(item.get("name", "")), alias_to_canonical)
        if not name or name.lower() in seen:
            continue
        fraction = item.get("fraction")
        if fraction is not None:
            try:
                fraction = compact_number(float(fraction))
            except (TypeError, ValueError):
                fraction = None
        normalized.append({"name": name, "fraction": fraction})
        seen.add(name.lower())
    return normalized


def finalize_record(
    record: dict[str, Any],
    alias_to_canonical: dict[str, str],
) -> dict[str, Any]:
    record["components"] = normalize_components(record.get("components", []), alias_to_canonical)
    component_names = [item["name"] for item in record["components"]]
    record["component_names"] = component_names
    record["component_key"] = " + ".join(component_names)
    record["component_aliases"] = aliases_for_components(component_names, alias_to_canonical)

    temperature_k = parse_temperature_k(str(record.get("temperature", "")))
    pressure_pa = parse_pressure_pa(str(record.get("pressure", "")))
    record["temperature_k"] = temperature_k
    record["pressure_pa"] = pressure_pa
    record["pressure_atm"] = (
        compact_number(float(pressure_pa) / ATM_IN_PA) if pressure_pa is not None else None
    )

    quality_flags: list[str] = []
    fractions = [item.get("fraction") for item in record["components"]]
    if not record["components"]:
        quality_flags.append("missing_components")
    if any(value is None for value in fractions):
        quality_flags.append("missing_component_fraction")
        composition_sum = None
    else:
        composition_sum = compact_number(sum(float(value) for value in fractions))
        if not math.isclose(float(composition_sum), 100.0, abs_tol=COMPOSITION_SUM_TOLERANCE):
            quality_flags.append("composition_sum_not_100")
    if temperature_k is None:
        quality_flags.append("missing_or_invalid_temperature")
    if pressure_pa is None:
        quality_flags.append("missing_or_invalid_pressure")

    record["composition_sum_pct"] = composition_sum
    record["quality_flags"] = quality_flags
    record["data_quality"] = "ok" if not quality_flags else "warning"
    record["match_ready"] = bool(
        record["components"]
        and not any(value is None for value in fractions)
        and temperature_k is not None
        and pressure_pa is not None
    )

    source = record.get("source", "")
    if source == "read_error":
        record["parse_status"] = "error"
    elif source in {"manual_override", "identifier"} and record["components"]:
        record["parse_status"] = "ok"
    elif record["components"]:
        record["parse_status"] = "fallback"
    else:
        record["parse_status"] = "needs_review"

    record["search_text"] = " ".join([
        record.get("path", ""),
        record.get("identifier", ""),
        record.get("component_key", ""),
        " ".join(record.get("component_aliases", [])),
        record.get("temperature", ""),
        record.get("pressure", ""),
    ]).lower()
    return record


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
            text, sha256 = read_text_and_hash(path)
        except OSError as exc:
            record = {
                "path": path_text,
                "file_name": path.name,
                "directory": rel(path.parent, root),
                "identifier": "",
                "components": [],
                "temperature": "",
                "pressure": "",
                "source": "read_error",
                "error": str(exc),
                "size_bytes": path.stat().st_size if path.exists() else None,
                "sha256": "",
            }
            records.append(finalize_record(record, alias_to_canonical))
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

        record: dict[str, Any] = {
            "path": path_text,
            "file_name": path.name,
            "directory": rel(path.parent, root),
            "identifier": parsed["identifier"],
            "components": components,
            "temperature": temperature,
            "pressure": pressure,
            "source": source,
            "size_bytes": path.stat().st_size,
            "sha256": sha256,
        }
        if path_text in overrides:
            record = apply_override(record, overrides[path_text])
        records.append(finalize_record(record, alias_to_canonical))

    component_counter: Counter[str] = Counter()
    status_counter: Counter[str] = Counter()
    quality_counter: Counter[str] = Counter()
    for record in records:
        status_counter[record.get("parse_status", "unknown")] += 1
        for name in record.get("component_names", []):
            component_counter[name] += 1
        for flag in record.get("quality_flags", []):
            quality_counter[flag] += 1

    summary = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "total_files": len(records),
        "match_ready_files": sum(bool(record.get("match_ready")) for record in records),
        "status_counts": dict(sorted(status_counter.items())),
        "quality_flag_counts": dict(sorted(quality_counter.items())),
        "component_counts": dict(
            sorted(component_counter.items(), key=lambda item: (-item[1], item[0].lower()))
        ),
    }
    return records, summary


def render_report(records: list[dict[str, Any]], summary: dict[str, Any]) -> str:
    lines = [
        "# Gas File Index Report",
        "",
        f"Schema version: **{SCHEMA_VERSION}**",
        "",
        f"Generated at UTC: `{summary['generated_at_utc']}`",
        "",
        f"Total indexed files: **{summary['total_files']}**",
        "",
        f"Ready for numeric matching: **{summary['match_ready_files']}**",
        "",
        "## Parse Status",
        "",
    ]
    for status, count in summary["status_counts"].items():
        lines.append(f"- `{status}`: {count}")
    lines.extend(["", "## Data Quality Flags", ""])
    if summary["quality_flag_counts"]:
        for flag, count in summary["quality_flag_counts"].items():
            lines.append(f"- `{flag}`: {count}")
    else:
        lines.append("No data quality flags.")
    lines.extend(["", "## Component Counts", ""])
    for component, count in summary["component_counts"].items():
        lines.append(f"- `{component}`: {count}")

    needs_review = [
        record for record in records if record.get("parse_status") in {"needs_review", "error"}
    ]
    fallback = [record for record in records if record.get("parse_status") == "fallback"]
    quality_issues = [record for record in records if record.get("quality_flags")]
    lines.extend(["", "## Needs Review", ""])
    if needs_review:
        for record in needs_review:
            lines.append(f"- `{record['path']}` ({record.get('source', 'unknown')})")
    else:
        lines.append("No files require manual review.")
    lines.extend(["", "## Data Quality Review", ""])
    if quality_issues:
        for record in quality_issues:
            flags = ", ".join(record.get("quality_flags", []))
            lines.append(f"- `{record['path']}` -> {flags}")
    else:
        lines.append("No files have data quality warnings.")
    lines.extend(["", "## Parsed By Path Fallback", ""])
    if fallback:
        for record in fallback:
            components = ", ".join(record.get("component_names", [])) or "unknown"
            lines.append(f"- `{record['path']}` -> {components}")
    else:
        lines.append("No files required path fallback.")
    return "\n".join(lines) + "\n"


def write_index(
    index_path: Path,
    report_path: Path,
    records: list[dict[str, Any]],
    summary: dict[str, Any],
    pretty: bool,
) -> None:
    output = {"schema_version": SCHEMA_VERSION, "summary": summary, "files": records}
    index_path.write_text(
        json.dumps(
            output,
            ensure_ascii=False,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
        ) + "\n",
        encoding="utf-8",
    )
    report_path.write_text(render_report(records, summary), encoding="utf-8")


def check_index(
    index_path: Path,
    report_path: Path,
    records: list[dict[str, Any]],
    summary: dict[str, Any],
) -> bool:
    if not index_path.exists() or not report_path.exists():
        print("Gas index or report is missing. Rebuild the index.")
        return False
    try:
        existing = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Cannot read existing gas index: {exc}")
        return False
    existing_summary = existing.get("summary", {})
    expected_summary = dict(summary)
    expected_summary["generated_at_utc"] = existing_summary.get("generated_at_utc", "")
    index_matches = (
        existing.get("schema_version") == SCHEMA_VERSION
        and existing.get("files") == records
        and existing_summary == expected_summary
    )
    report_matches = report_path.read_text(encoding="utf-8") == render_report(records, expected_summary)
    if index_matches and report_matches:
        print(f"Gas index is current ({len(records)} files, schema {SCHEMA_VERSION}).")
        return True
    print("Gas index is stale. Run: python3 tools/build_gas_index.py --pretty")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build GasFile/gas_index.json from Garfield gas files."
    )
    parser.add_argument("--root", default=".", help="Repository root. Default: current directory.")
    parser.add_argument("--pretty", action="store_true", help="Write indented JSON.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check that the committed index and report match the gas files.",
    )
    args = parser.parse_args()
    root = Path(args.root).resolve()
    records, summary = build_index(root)
    index_path = root / "GasFile" / "gas_index.json"
    report_path = root / "GasFile" / "gas_index_report.md"
    if args.check:
        return 0 if check_index(index_path, report_path, records, summary) else 1
    write_index(index_path, report_path, records, summary, args.pretty)
    print(f"Indexed {summary['total_files']} files")
    print(f"Ready for numeric matching: {summary['match_ready_files']}")
    print(f"Status: {summary['status_counts']}")
    print(f"Quality flags: {summary['quality_flag_counts']}")
    print(f"Wrote {index_path}")
    print(f"Wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
