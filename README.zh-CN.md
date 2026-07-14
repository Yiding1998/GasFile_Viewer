# GasFile_Viewer

[English](README.md) | [简体中文](README.zh-CN.md)

GasFile_Viewer 提供用于查看和检索 Garfield++ 气体文件的浏览器工具。本仓库包含气体文件集合、独立的气体文件查看器，以及根据气体文件实际内容生成的检索索引。

## 可用工具

- [Garfield 气体文件工作台](garfield_gas_workbench_pro.html)：下载该 HTML 文件后，可直接用浏览器打开并查看气体文件。
- [气体文件检索程序](gas_file_search.html)：可以根据气体成分、别名、比例、温度、压强、标识符或文件路径检索气体文件。

## 程序使用手册

源文档存放路径为：

`/ustcfs/STCFUser/yzhao/Simulation/Garfield/GasFile_Viewer/Doc`

在 GitHub 上也可以点击以下链接打开相应文档：

- [英文使用手册（Markdown）](Doc/Garfield_gas_workbench_pro_User_Manual_EN.md)
- [英文使用手册（PDF）](Doc/Garfield_gas_workbench_pro_User_Manual_EN.pdf)
- [中文使用手册（Markdown）](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.md)
- [中文使用手册（PDF）](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf)

## 使用气体文件检索程序

### 通过 GitHub Pages 在线使用

仓库启用 GitHub Pages 后，可直接访问：

[https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html](https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html)

仓库所有者可以进入 `Settings -> Pages`，在发布来源中选择 `Deploy from a branch`，分支选择 `main`，目录选择 `/(root)`，然后保存设置。

不要把 GitHub 中 `gas_file_search.html` 的源代码预览页面当作检索程序使用。检索页面必须通过 GitHub Pages 或本地网页服务器打开，才能读取 [GasFile/gas_index.json](GasFile/gas_index.json)。

### 在本地使用

需要安装 Git 和 Python 3。

```bash
git clone https://github.com/Yiding1998/GasFile_Viewer.git
cd GasFile_Viewer
python3 -m http.server 8000
```

然后在浏览器中打开：

```text
http://127.0.0.1:8000/gas_file_search.html
```

使用结束后，可在终端中按 `Ctrl+C` 停止本地服务器。不建议通过 `file://` 地址直接打开 `gas_file_search.html`，因为浏览器可能阻止页面读取 JSON 索引。

### 检索示例

- 输入 `Ar CO2` 并选择 `All terms`，可查找同时含有 Ar 和 CO2 的混合气体。
- 输入 `R134a` 或 `C2H2F4`，可通过不同别名检索对应气体文件。
- 输入 `isobutane` 或 `i-C4H10`，可检索异丁烷混合气体。
- 选择 `Any term` 时，只要任意一个检索词匹配即可显示结果。
- 可以使用气体成分、解析状态和排序选项进一步筛选结果。
- 每条结果提供 `Open`、`Download` 和 `Copy path`，用于打开、下载或复制气体文件路径。

普通用户不需要重新生成索引，只需使用最新版本的仓库或当前的 GitHub Pages 页面。

## 新增气体文件

将新气体文件放入 `GasFile/` 目录，然后在仓库根目录重新生成索引：

```bash
python3 tools/build_gas_index.py --pretty
```

检查 [GasFile/gas_index_report.md](GasFile/gas_index_report.md)，然后提交新增的气体文件和重新生成的索引：

```bash
git add GasFile tools README.md README.zh-CN.md gas_file_search.html
git commit -m "Update gas files and search index"
git push origin main
```

索引生成程序会读取每个 Garfield 气体文件，并优先解析文件内部的 `Identifier:` 信息，例如 `Ar 90%, CO2 10%, T=293.15 K, p=1 atm`。因此，即使气体文件命名不规则，也可以按照文件中的实际气体成分进行检索。

无法完整解析的文件会记录在 [GasFile/gas_index_report.md](GasFile/gas_index_report.md) 中。特殊文件可以在 [GasFile/gas_metadata_override.json](GasFile/gas_metadata_override.json) 中手动修正，气体成分的其他名称可以在 [GasFile/gas_aliases.json](GasFile/gas_aliases.json) 中维护。

重新生成的索引推送后，GitHub Pages 会自动使用最新数据。其他用户只需要刷新检索页面。
