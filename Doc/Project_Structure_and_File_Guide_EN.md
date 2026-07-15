# GasFile_Viewer Project Structure and File Guide

[简体中文](项目结构与文件说明.md) | [Back to English README](../README.md)

## 1. Purpose

This short guide gives new users and maintainers a map of the repository, the purpose of each major file, ownership boundaries, and the correct file to change for common tasks. For algorithms, data structures, and key functions, read the [Code Design and Implementation Guide](Code_Design_and_Implementation_EN.md). For workbench operation, read the [English User Manual](Garfield_gas_workbench_pro_User_Manual_EN.md).

This document describes the project structure as of 2026-07-15. The search index uses schema v3.

## 2. Project Overview

GasFile_Viewer is a static web project with no application server. It consists of:

1. A collection of Garfield++ `.gas` files and a content-derived index.
2. A standalone gas search page and localized Chinese and English workbenches.
3. Index generation, tests, and automated GitHub Pages deployment.

The online data flow is:

```text
Gas files under GasFile
        -> Python index builder
        -> GasFile/gas_index.json
        -> standalone search or workbench search dialog
        -> selected files parsed, plotted, analyzed, and exported in the workbench
```

## 3. Directory Tree

```text
GasFile_Viewer/
├── QUICK_START.md
├── README.md
├── README.zh-CN.md
├── index.html
├── gas_file_search.html
├── garfield_gas_workbench_pro.html
├── garfield_gas_workbench_pro_english.html
├── garfield_workbench_offline_zh.html
├── garfield_workbench_offline_en.html
├── garfield_gas_multi_file_viewer_advanced_legend.html
├── assets/js/
│   ├── gas-search-core.js
│   ├── gas-file-parser.js
│   └── workbench-library.js
├── legacy/
│   └── garfield_gas_multi_file_viewer_advanced_legend.html
├── GasFile/
│   ├── gas_aliases.json
│   ├── gas_metadata_override.json
│   ├── gas_index.json
│   ├── gas_index_report.md
│   └── Garfield gas files and category directories
├── tools/
│   ├── build_gas_index.py
│   └── build_standalone_workbenches.py
├── tests/
│   ├── test_build_gas_index.py
│   ├── test-gas-file-parser.js
│   └── test_web_integration.py
├── Doc/
│   ├── localized workbench manuals and PDFs
│   └── localized project and implementation guides
├── .github/workflows/
│   └── gas-search.yml
└── .gitignore
```

`.git/` contains Git's local repository internals. It is not an application directory and must not be edited manually.

## 4. Root Application Files

| File | Type | Purpose | Maintenance guidance |
|---|---|---|---|
| `QUICK_START.md` | Maintained documentation | Root-level bilingual click-and-use instructions for occasional or one-time users. | Keep it minimal: online entry points and essential cautions only. |
| `index.html` | Maintained source | GitHub Pages root entry that routes to the Chinese or English online workbench according to browser language. | Keep it small; do not duplicate workbench behavior here. |
| `gas_file_search.html` | Maintained source | Standalone English search page. It loads the index; searches by components, fractions, temperature, pressure, quality, and text; sorts results; creates share URLs; exports CSV; and links to both workbenches. | Edit for query UI or result presentation. Put matching-rule changes in the shared core. |
| `assets/js/gas-search-core.js` | Maintained source | Shared unit conversion, matching, scoring, and sorting logic used by both search interfaces. | Add tests for every matching-rule change and verify both consumers. |
| `assets/js/gas-file-parser.js` | Maintained source | Shared Garfield gas-table parser and physical conversions used by both localized Pro workbenches. It preserves per-record extension values without shifting later records. | Keep format handling language-neutral; localize only wrapper error messages in the HTML pages. |
| `assets/js/workbench-library.js` | Maintained source | Injects the repository search dialog into both workbenches and handles index loading, safe downloads, hash verification, deduplication, and batch insertion. | Edit for repository integration, security controls, or batch loading. |
| `garfield_gas_workbench_pro.html` | Maintained source | Chinese workbench with localized parser messages, file management, comparison plots, analysis, fitting, heat maps, export, and project persistence. | Keep functionality and element IDs synchronized with the English file. |
| `garfield_gas_workbench_pro_english.html` | Maintained source | English workbench with the same intended feature set as the Chinese workbench. | Functional changes must also be applied to the Chinese version. |
| `garfield_workbench_offline_zh.html` | Generated | Chinese single-file offline workbench with all shared JavaScript embedded for direct local gas-file loading. | Do not edit directly; run the standalone builder. |
| `garfield_workbench_offline_en.html` | Generated | English single-file offline workbench. | Do not edit directly; run the standalone builder. |
| `garfield_gas_multi_file_viewer_advanced_legend.html` | Compatibility redirect | Preserves the old public URL and redirects to the implementation under `legacy/`. | Do not remove; historical links depend on it. |
| `legacy/garfield_gas_multi_file_viewer_advanced_legend.html` | Compatibility source | Earlier independent Chinese multi-file viewer. | Fix only serious defects; add new features to the `pro` workbenches. |
| `README.md` | Maintained documentation | English project landing page, online entry points, user workflows, and instructions for adding gas files. | Update when user-visible behavior changes. |
| `README.zh-CN.md` | Maintained documentation | Chinese project landing page whose main technical facts should match the English README. | Update together with the English README. |

## 5. `GasFile/` Data Directory

This directory contains the actual Garfield gas files, currently grouped into Ar, Ne, typical RPC mixtures, pure gases, and related categories. Names and directories help people navigate, but the index prefers the internal `Identifier:`, `Dimension:`, electric-field, magnetic-field, and angle data.

| File or content | Type | Purpose | Manual editing |
|---|---|---|---|
| Gas files in category directories | Data | Garfield++ transport tables used by search and workbench plots. | Files may be added or replaced; rebuild the index and run tests afterward. |
| `gas_aliases.json` | Configuration | Normalizes aliases such as `argon`, `R134a`, and `isobutane` to canonical component names. | Edit when adding a confirmed synonym. |
| `gas_metadata_override.json` | Configuration | Overrides automatically parsed metadata for a specific repository-relative path. It is empty by default. | Use only for verified exceptional files, not to hide a general parser defect. |
| `gas_index.json` | Generated | Schema v3 index containing composition, fractions, normalized conditions, quality flags, hashes, and transport-grid coverage. | Do not edit by hand; run the builder. |
| `gas_index_report.md` | Generated | Summarizes parse status, quality warnings, component counts, and files requiring review. | Do not edit by hand. |

The collection is intentionally not enumerated file by file in this guide. Every gas file has its own index record and can be traced by repository path and SHA-256.

## 6. Tooling, Tests, and Automation

| File | Type | Purpose |
|---|---|---|
| `tools/build_gas_index.py` | Maintained source | Scans `GasFile/`, parses content and path fallbacks, applies aliases and overrides, writes the index and report, and detects a stale committed index. |
| `tools/build_standalone_workbenches.py` | Maintained source | Embeds the parser, search core, and repository library in both localized workbenches to generate one-HTML offline editions. |
| `tests/test_build_gas_index.py` | Maintained source | Covers condition units, `Identifier:` parsing, quality flags, transport coverage, and the index lifecycle. |
| `tests/test-gas-file-parser.js` | Maintained source | Parses every repository gas file with the shared module and locks record alignment for regular and extended layouts. |
| `tests/test_web_integration.py` | Maintained source | Checks static integration contracts for both workbenches, shared scripts, security controls, parametric X axes, and localized workbench links. |
| `.github/workflows/gas-search.yml` | Maintained configuration | On selected pushes, pull requests, or manual runs, tests the project, rebuilds and verifies the index, and deploys the repository to GitHub Pages. |
| `.gitignore` | Maintained configuration | Excludes Python caches and compiled artifacts from version control. |

## 7. `Doc/` Documentation

| File | Purpose |
|---|---|
| `Garfield_gas_workbench_pro_使用说明.md` | Complete Chinese workbench user manual. |
| `Garfield_gas_workbench_pro_User_Manual_EN.md` | Complete English workbench user manual. |
| Matching `.pdf` files | Portable versions of the manuals. PDFs must be regenerated separately after Markdown changes. |
| `项目结构与文件说明.md` | Chinese version of this short repository map. |
| `Project_Structure_and_File_Guide_EN.md` | This document. |
| `代码设计与实现说明.md` | Detailed Chinese developer guide. |
| `Code_Design_and_Implementation_EN.md` | Detailed English developer guide. |

## 8. Common Tasks and Their Files

| Task | Primary files | Required checks |
|---|---|---|
| Add gas files | `GasFile/` | Rebuild the index, inspect the report, and run all tests. |
| Add a component alias | `GasFile/gas_aliases.json` | Rebuild and verify search behavior. |
| Correct exceptional metadata | `GasFile/gas_metadata_override.json` | Rebuild and confirm `source=manual_override`. |
| Change matching scores | `assets/js/gas-search-core.js` | Test both standalone and integrated search. |
| Change Garfield table parsing | `assets/js/gas-file-parser.js` | Run the Node parser regression over every repository gas file and verify both localized wrappers. |
| Change standalone search UI | `gas_file_search.html` | Check share URLs, CSV, mobile layout, and workbench links. |
| Change workbench functionality | Both `garfield_gas_workbench_pro*.html` files | Keep IDs, project format, and localized behavior aligned. |
| Change repository integration | `assets/js/workbench-library.js` | Check path validation, hashes, deduplication, cancellation, and batch loading. |
| Change the index schema | `tools/build_gas_index.py` | Update the schema, tests, consumers, and localized documentation. |
| Change deployment | `.github/workflows/gas-search.yml` | Verify that pull requests validate without deploying and `main` deploys successfully. |

## 9. Generated Files and Ownership Boundaries

- `GasFile/gas_index.json` and `GasFile/gas_index_report.md` are builder-owned outputs.
- The Pages workflow rebuilds the index in its temporary runner but does not create a bot commit.
- A local clone must run the builder before its committed index reflects newly added files.
- The current Actions workflow does not regenerate PDFs. Decide explicitly whether a manual PDF refresh is needed after Markdown manual changes.
- The localized `pro` workbenches still contain parallel UI and plotting code, but both use `assets/js/gas-file-parser.js` for identical Garfield parsing and physical conversions.

## 10. Minimum Maintenance Check

```bash
python3 tools/build_gas_index.py --pretty
python3 tools/build_gas_index.py --check
python3 -m unittest discover -s tests -v
node tests/test-gas-file-parser.js
git diff --check
```

Before committing, also serve the repository over local HTTP and open both workbenches and the standalone search page to verify that the browser can load `GasFile/gas_index.json`.
