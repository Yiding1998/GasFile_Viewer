from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WorkbenchLibraryContractTests(unittest.TestCase):
    def read(self, name: str) -> str:
        return (ROOT / name).read_text(encoding="utf-8")

    def test_both_localized_workbenches_load_the_shared_library(self) -> None:
        for name, language in [
            ("garfield_gas_workbench_pro.html", "zh-CN"),
            ("garfield_gas_workbench_pro_english.html", "en"),
        ]:
            html = self.read(name)
            self.assertIn(f'<html lang="{language}">', html)
            self.assertIn("window.GarfieldWorkbenchBridge", html)
            self.assertIn('src="gas-search-core.js"', html)
            self.assertIn('src="workbench-library.js"', html)
            self.assertIn("sourceSha256", html)
            self.assertIn("sourcePath", html)
            self.assertIn("file.arrayBuffer()", html)

    def test_library_limits_remote_paths_and_verifies_content(self) -> None:
        script = self.read("workbench-library.js")
        self.assertIn("file.path.startsWith('GasFile/')", script)
        self.assertIn("file.path.includes('..')", script)
        self.assertIn("url.origin!==location.origin", script)
        self.assertIn("crypto.subtle.digest('SHA-256'", script)
        self.assertIn("response.arrayBuffer()", script)
        self.assertIn("200*1024*1024", script)
        self.assertIn("AbortController", script)

    def test_transport_parameters_can_drive_the_x_axis(self) -> None:
        for name in [
            "garfield_gas_workbench_pro.html",
            "garfield_gas_workbench_pro_english.html",
        ]:
            html = self.read(name)
            self.assertEqual(html.count('id="pointOrder"'), 1)
            self.assertEqual(html.count('id="showXErrors"'), 1)
            self.assertIn("appendParamGroup($('xSelect')", html)
            self.assertIn("parametric?'sourceEoverP':'x'", html)
            self.assertIn("xErr:parametric?getErr", html)
            self.assertIn("nearestByX(item.points,x)", html)
            self.assertIn("'source_E_V_cm'", html)
            self.assertIn("'source_E_over_P'", html)
            self.assertIn("'pointOrder','showErrors','showXErrors'", html)

    def test_identifier_composition_is_authoritative_for_legend_and_scans(self) -> None:
        fixture = self.read(
            "GasFile/RPCgas_Typical/Different_GasFraction/"
            "c2h2f4_ic4h10_sf6_90_5_5.gas"
        )
        self.assertIn(
            "Identifier: C2H2F4 90%, iC4H10 5%, SF6 5%",
            fixture,
        )
        for name in [
            "garfield_gas_workbench_pro.html",
            "garfield_gas_workbench_pro_english.html",
        ]:
            html = self.read(name)
            self.assertIn("function canonicalGasName(name)", html)
            self.assertIn("/^i-?c4h10$/i.test(name)?'i-C4H10':name", html)
            self.assertIn(
                "return Object.keys(identifier).length?identifier:arrayComposition(g)",
                html,
            )
            self.assertNotIn(
                "return{...arrayComposition(g),...identifierComposition(g)}",
                html,
            )

    def test_standalone_search_uses_shared_core_and_links_both_workbenches(self) -> None:
        html = self.read("gas_file_search.html")
        self.assertIn('src="gas-search-core.js"', html)
        self.assertIn("searchCore.evaluate", html)
        self.assertIn("searchCore.sortResults", html)
        self.assertIn("garfield_gas_workbench_pro_english.html?gas=", html)
        self.assertIn("garfield_gas_workbench_pro.html?gas=", html)


if __name__ == "__main__":
    unittest.main()
