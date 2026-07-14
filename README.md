# GasFile_Viewer

[English](README.md) | [简体中文](README.zh-CN.md)

GasFile_Viewer provides browser-based tools for viewing and searching Garfield++ gas files. The repository contains the gas-file collection, a standalone gas-file viewer, and a content-derived numeric search index.

## Available Tools

- [Garfield Gas Workbench](garfield_gas_workbench_pro.html): download the HTML file and open it directly in a browser to inspect a gas file.
- [Gas File Search](gas_file_search.html): search and rank indexed files by gas components, fractions, temperature, pressure, aliases, identifier, or path.

## User Manuals

The source manuals are stored in:

**/ustcfs/STCFUser/yzhao/Simulation/Garfield/GasFile_Viewer/Doc**

The same documents can be opened from GitHub:

- [English User Manual (Markdown)](Doc/Garfield_gas_workbench_pro_User_Manual_EN.md)
- [English User Manual (PDF)](Doc/Garfield_gas_workbench_pro_User_Manual_EN.pdf)
- [Chinese User Manual (Markdown)](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.md)
- [Chinese User Manual (PDF)](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf)

## Using Gas File Search

### Online with GitHub Pages

After GitHub Pages has been configured, open:

[https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html](https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html)

The repository includes [a GitHub Actions workflow](.github/workflows/gas-search.yml) that validates the index and deploys the site. The repository owner must select **Settings -> Pages -> Source -> GitHub Actions** once. Later pushes to **main** are validated and deployed automatically.

Do not use the GitHub source-code preview of **gas_file_search.html** as the search application. The page must be served through GitHub Pages or a local web server so that it can load [GasFile/gas_index.json](GasFile/gas_index.json).

### Run Locally

Requirements: Git and Python 3.

~~~bash
git clone https://github.com/Yiding1998/GasFile_Viewer.git
cd GasFile_Viewer
python3 -m http.server 8000
~~~

Open:

~~~text
http://127.0.0.1:8000/gas_file_search.html
~~~

Stop the server with **Ctrl+C**. Opening the page through a **file://** address is not recommended because browsers may block the JSON request.

### Search Modes

- **Nearest** requires the selected gas components, then ranks files by normalized composition, temperature, and pressure differences.
- **Within range** only returns files inside the fraction, temperature, and relative-pressure tolerances.
- **Exact** requires an identical component set and exact values for every entered numeric parameter.

**Exact component set** rejects files containing additional gases. Disable it to allow mixtures that contain the requested components plus other gases.

### Composition and Conditions

1. Add one row for each gas component.
2. Enter the target percentage and percentage-point tolerance.
3. Use **Balance last** to set the final component to 100% minus the preceding fractions.
4. Enter optional temperature and pressure targets.
5. Choose temperature units from K, °C, or °F.
6. Choose pressure units from atm, bar, mbar, Pa, kPa, or Torr.

For an exact component set with all fractions entered, the fractions must total 100%. Incomplete or invalid parameters are reported before matching.

Every result shows the composition difference in percentage points, temperature difference in kelvin, and relative pressure difference. Results with missing numeric metadata are excluded when the missing parameter is part of the query.

### Result Tools

- Sort by overall, composition, temperature, pressure, or path.
- Search aliases such as R134a, C2H2F4, isobutane, and i-C4H10.
- Copy a shareable URL containing the current query.
- Export the current result set as CSV.
- Open, download, or copy the path of a gas file.
- Filter files that are fully ready for numeric matching or have data warnings.

Nearest matching is a retrieval aid, not proof that a gas file is physically interchangeable with the requested conditions. Check the file's electric-field, magnetic-field, angle, and table coverage before using it in a simulation.

Regular users do not need to rebuild the index. They only need the latest repository version or the current GitHub Pages site.

## Adding New Gas Files

Place new files under **GasFile/**, then rebuild the index from the repository root:

~~~bash
python3 tools/build_gas_index.py --pretty
~~~

Review [GasFile/gas_index_report.md](GasFile/gas_index_report.md), run the tests and consistency check, then commit the new files and regenerated index:

~~~bash
python3 -m unittest discover -s tests -v
python3 tools/build_gas_index.py --check
git add GasFile tools tests .github README.md README.zh-CN.md gas_file_search.html
git commit -m "Update gas files and search index"
git push origin main
~~~

The schema v2 index stores normalized values in **temperature_k**, **pressure_pa**, and **pressure_atm** while preserving the original text. It also records composition totals, data-quality flags, match readiness, file size, and SHA-256 content hashes.

The builder prefers each file's internal **Identifier:** line, for example **Ar 90%, CO2 10%, T=293.15 K, p=1 atm**. Irregular file names therefore remain searchable by actual content. Files that cannot be fully parsed are listed in [GasFile/gas_index_report.md](GasFile/gas_index_report.md). Add special corrections to [GasFile/gas_metadata_override.json](GasFile/gas_metadata_override.json), and maintain component aliases in [GasFile/gas_aliases.json](GasFile/gas_aliases.json).

GitHub Actions rejects a stale committed index and deploys the validated search site after changes reach **main**.
