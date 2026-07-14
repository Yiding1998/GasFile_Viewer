from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_gas_index",
    ROOT / "tools" / "build_gas_index.py",
)
assert SPEC and SPEC.loader
gas_index = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gas_index)


class QuantityParsingTests(unittest.TestCase):
    def test_temperature_units_are_normalized_to_kelvin(self) -> None:
        self.assertEqual(gas_index.parse_temperature_k("293.15 K"), 293.15)
        self.assertEqual(gas_index.parse_temperature_k("20 C"), 293.15)
        self.assertEqual(gas_index.parse_temperature_k("68 F"), 293.15)
        self.assertIsNone(gas_index.parse_temperature_k("20 bananas"))

    def test_pressure_units_are_normalized_to_pascal(self) -> None:
        self.assertEqual(gas_index.parse_pressure_pa("1 atm"), 101325)
        self.assertEqual(gas_index.parse_pressure_pa("1000 mbar"), 100000)
        self.assertEqual(gas_index.parse_pressure_pa("1 bar"), 100000)
        self.assertAlmostEqual(gas_index.parse_pressure_pa("760 Torr"), 101325)
        self.assertIsNone(gas_index.parse_pressure_pa("-1 atm"))


class GasParsingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.aliases = {
            "ar": "Ar",
            "argon": "Ar",
            "co2": "CO2",
            "carbon dioxide": "CO2",
        }

    def test_identifier_parses_aliases_and_numeric_values(self) -> None:
        parsed = gas_index.parse_identifier(
            "Identifier: argon 90%, CO2 10%, T=293.15 K, p=1 atm\n",
            self.aliases,
        )
        self.assertEqual(
            parsed["components"],
            [{"name": "Ar", "fraction": 90}, {"name": "CO2", "fraction": 10}],
        )
        self.assertEqual(parsed["temperature"], "293.15 K")
        self.assertEqual(parsed["pressure"], "1 atm")

    def test_record_quality_and_match_ready_fields(self) -> None:
        record = gas_index.finalize_record(
            {
                "path": "GasFile/example.gas",
                "identifier": "Ar 90%, CO2 10%, T=293.15 K, p=1 atm",
                "components": [
                    {"name": "Ar", "fraction": 90},
                    {"name": "CO2", "fraction": 10},
                ],
                "temperature": "293.15 K",
                "pressure": "1 atm",
                "source": "identifier",
            },
            self.aliases,
        )
        self.assertTrue(record["match_ready"])
        self.assertEqual(record["composition_sum_pct"], 100)
        self.assertEqual(record["temperature_k"], 293.15)
        self.assertEqual(record["pressure_pa"], 101325)
        self.assertEqual(record["quality_flags"], [])

    def test_missing_fraction_is_reported(self) -> None:
        record = gas_index.finalize_record(
            {
                "path": "GasFile/fallback.gas",
                "identifier": "",
                "components": [{"name": "Ar", "fraction": None}],
                "temperature": "293.15 K",
                "pressure": "1000 mbar",
                "source": "path_fallback",
            },
            self.aliases,
        )
        self.assertFalse(record["match_ready"])
        self.assertIn("missing_component_fraction", record["quality_flags"])


class TransportCoverageTests(unittest.TestCase):
    SAMPLE_HEADER = """
 Version   : 12
 GASOK bits: TFTTFTTTTTTFFFFTFFFF
 Dimension : F         3         2         2         4         5
 E fields
 1.0D+00 2.5E+00 5.0E+00
 E-B angles
 0.0 1.57079633
 B fields
 0.0 5.0E+01
 Mixture:
 """

    def test_transport_grid_coverage_is_extracted(self) -> None:
        coverage = gas_index.parse_transport_coverage(self.SAMPLE_HEADER)
        self.assertEqual(coverage["format_version"], 12)
        self.assertFalse(coverage["map_2d"])
        self.assertEqual(coverage["gasok_bits"], "TFTTFTTTTTTFFFFTFFFF")
        self.assertEqual(
            coverage["dimensions"],
            {
                "electric_field_count": 3,
                "angle_count": 2,
                "magnetic_field_count": 2,
                "excitation_count": 4,
                "ionisation_count": 5,
            },
        )
        self.assertEqual(coverage["e_over_p_v_cm_torr"], {"min": 1, "max": 5})
        self.assertEqual(coverage["magnetic_field_t"], {"min": 0, "max": 0.5})
        self.assertEqual(
            coverage["angle_rad"],
            {"min": 0, "max": 1.57079633},
        )

    def test_missing_dimension_has_no_coverage(self) -> None:
        self.assertEqual(gas_index.parse_transport_coverage("Identifier: Ar 100%"), {})


class IndexLifecycleTests(unittest.TestCase):
    def test_index_check_detects_stale_gas_content(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            gas_root = root / "GasFile"
            gas_root.mkdir()
            (gas_root / "gas_aliases.json").write_text(
                json.dumps({
                    "groups": [
                        {"canonical": "Ar", "aliases": ["argon"]},
                        {"canonical": "CO2", "aliases": []},
                    ]
                }),
                encoding="utf-8",
            )
            (gas_root / "gas_metadata_override.json").write_text("{}", encoding="utf-8")
            gas_file = gas_root / "sample.gas"
            gas_file.write_text(
                "Identifier: Ar 90%, CO2 10%, T=293.15 K, p=1 atm\n",
                encoding="utf-8",
            )

            records, summary = gas_index.build_index(root)
            index_path = gas_root / "gas_index.json"
            report_path = gas_root / "gas_index_report.md"
            gas_index.write_index(index_path, report_path, records, summary, pretty=True)
            self.assertTrue(
                gas_index.check_index(index_path, report_path, records, summary)
            )

            gas_file.write_text(
                "Identifier: Ar 80%, CO2 20%, T=293.15 K, p=1 atm\n",
                encoding="utf-8",
            )
            changed_records, changed_summary = gas_index.build_index(root)
            self.assertFalse(
                gas_index.check_index(
                    index_path,
                    report_path,
                    changed_records,
                    changed_summary,
                )
            )


if __name__ == "__main__":
    unittest.main()
