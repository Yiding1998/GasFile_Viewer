# GasFile_Viewer

[English](README.md) | [简体中文](README.zh-CN.md)

GasFile_Viewer provides browser-based tools for viewing and searching Garfield++ gas files. The repository contains the gas-file collection, a standalone gas-file viewer, and a searchable index generated from the actual contents of the gas files.

## Available Tools

- [Garfield Gas Workbench](garfield_gas_workbench_pro.html): download the HTML file and open it directly in a browser to inspect a gas file.
- [Gas File Search](gas_file_search.html): search the indexed collection by gas component, alias, fraction, temperature, pressure, identifier, or path.

## User Manuals

The source manuals are stored in:

`/ustcfs/STCFUser/yzhao/Simulation/Garfield/GasFile_Viewer/Doc`

The same documents can be opened from GitHub:

- [English User Manual (Markdown)](Doc/Garfield_gas_workbench_pro_User_Manual_EN.md)
- [English User Manual (PDF)](Doc/Garfield_gas_workbench_pro_User_Manual_EN.pdf)
- [Chinese User Manual (Markdown)](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.md)
- [Chinese User Manual (PDF)](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf)

## Using Gas File Search

### Online with GitHub Pages

After GitHub Pages has been enabled for this repository, open:

[https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html](https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html)

To enable the site, the repository owner should open `Settings -> Pages`, select `Deploy from a branch`, choose the `main` branch and the `/(root)` folder, and save the settings.

Do not use the GitHub source-code preview of `gas_file_search.html` as the search application. The page must be served through GitHub Pages or a local web server so that it can load [GasFile/gas_index.json](GasFile/gas_index.json).

### Run Locally

Requirements: Git and Python 3.

```bash
git clone https://github.com/Yiding1998/GasFile_Viewer.git
cd GasFile_Viewer
python3 -m http.server 8000
```

Then open the following address in a browser:

```text
http://127.0.0.1:8000/gas_file_search.html
```

Stop the local server with `Ctrl+C` when it is no longer needed. Opening `gas_file_search.html` directly through a `file://` address is not recommended because browsers may block the JSON index request.

### Search Examples

- Enter `Ar CO2` and select `All terms` to find mixtures containing both components.
- Enter `R134a` or `C2H2F4` to find files indexed under the corresponding aliases.
- Enter `isobutane` or `i-C4H10` to find isobutane mixtures.
- Use `Any term` when at least one search term should match.
- Use the component, parse-status, and sort controls to narrow or order the results.
- Use `Open`, `Download`, or `Copy path` on a result to access the selected gas file.

Regular users do not need to rebuild the index. They only need the latest repository version or the current GitHub Pages site.

## Adding New Gas Files

Place new gas files under `GasFile/`, then rebuild the index from the repository root:

```bash
python3 tools/build_gas_index.py --pretty
```

Review [GasFile/gas_index_report.md](GasFile/gas_index_report.md), then commit both the new gas files and regenerated index:

```bash
git add GasFile tools README.md README.zh-CN.md gas_file_search.html
git commit -m "Update gas files and search index"
git push origin main
```

The index builder reads each Garfield gas file and prefers its internal `Identifier:` line, for example `Ar 90%, CO2 10%, T=293.15 K, p=1 atm`. This allows files with irregular names to remain searchable by their actual gas composition.

Files that cannot be fully parsed are listed in [GasFile/gas_index_report.md](GasFile/gas_index_report.md). Add manual corrections to [GasFile/gas_metadata_override.json](GasFile/gas_metadata_override.json), and maintain alternative component names in [GasFile/gas_aliases.json](GasFile/gas_aliases.json).

Once the regenerated index is pushed, GitHub Pages uses the updated data automatically. Other users only need to refresh the search page.
