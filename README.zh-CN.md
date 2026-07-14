# GasFile_Viewer

[English](README.md) | [简体中文](README.zh-CN.md)

GasFile_Viewer 提供用于查看和检索 Garfield++ 气体文件的浏览器工具。本仓库包含气体文件集合、独立气体文件查看器，以及根据文件实际内容生成的数值检索索引。

## 可用工具

- [Garfield 气体文件工作台](garfield_gas_workbench_pro.html)：下载该 HTML 文件后，可以直接用浏览器打开并查看气体文件。
- [气体文件检索程序](gas_file_search.html)：根据气体成分、比例、温度、压强、别名、标识符或路径检索气体文件，并按照参数接近程度排序。

## 程序使用手册

源文档存放路径为：

**/ustcfs/STCFUser/yzhao/Simulation/Garfield/GasFile_Viewer/Doc**

在 GitHub 上也可以点击以下链接打开相应文档：

- [英文使用手册（Markdown）](Doc/Garfield_gas_workbench_pro_User_Manual_EN.md)
- [英文使用手册（PDF）](Doc/Garfield_gas_workbench_pro_User_Manual_EN.pdf)
- [中文使用手册（Markdown）](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.md)
- [中文使用手册（PDF）](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf)

## 使用气体文件检索程序

### 通过 GitHub Pages 在线使用

GitHub Pages 配置完成后，可以直接访问：

[https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html](https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html)

仓库已经包含[自动验证和发布工作流](.github/workflows/gas-search.yml)。仓库所有者只需首次进入 **Settings -> Pages -> Source** 并选择 **GitHub Actions**。此后推送到 **main** 的更新会自动验证并发布。

不要把 GitHub 中 **gas_file_search.html** 的源代码预览页面当作检索程序使用。检索页面必须通过 GitHub Pages 或本地网页服务器打开，才能读取 [GasFile/gas_index.json](GasFile/gas_index.json)。

### 在本地使用

需要安装 Git 和 Python 3。

~~~bash
git clone https://github.com/Yiding1998/GasFile_Viewer.git
cd GasFile_Viewer
python3 -m http.server 8000
~~~

然后在浏览器中打开：

~~~text
http://127.0.0.1:8000/gas_file_search.html
~~~

使用结束后，在终端中按 **Ctrl+C** 停止服务器。不建议通过 **file://** 地址直接打开页面，因为浏览器可能阻止读取 JSON 索引。

### 检索模式

- **Nearest**：先要求文件包含指定气体成分，再根据比例、温度和压强的标准化差异进行排序。
- **Within range**：只显示位于比例、温度和相对压强容差范围内的文件。
- **Exact**：气体成分集合必须完全相同，所有已输入的数值参数也必须精确匹配。

勾选 **Exact component set** 时，不允许结果包含额外气体。取消勾选后，可以检索包含指定成分以及其他气体的混合物。

### 输入气体成分和条件

1. 为每一种气体添加一行。
2. 输入目标比例和比例容差，比例容差单位为百分点。
3. 使用 **Balance last** 自动将最后一种气体设置为 100% 减去前面各气体比例。
4. 根据需要输入温度和压强。
5. 温度支持 K、°C 和 °F。
6. 压强支持 atm、bar、mbar、Pa、kPa 和 Torr。

当要求成分集合完全一致且所有比例都已填写时，比例总和必须为 100%。无效或不完整的检索条件会在匹配前显示出来。

每条结果会分别显示气体比例差、温度差和相对压强差。当检索使用了某个参数时，缺少该参数的文件不会参与排序。

### 结果操作

- 按综合差异、比例差异、温度差异、压强差异或路径排序。
- 使用 R134a、C2H2F4、isobutane、i-C4H10 等别名检索。
- 复制包含当前检索条件的共享链接。
- 将当前结果导出为 CSV。
- 打开、下载或复制气体文件路径。
- 筛选可完整参与数值匹配的文件或存在数据警告的文件。

“最接近”仅用于帮助查找候选文件，并不表示该文件在物理上可以直接替代目标条件。用于模拟前，仍需检查文件中的电场范围、磁场、夹角和气体表覆盖范围。

普通用户不需要重新生成索引，只需使用最新版本的仓库或当前 GitHub Pages 页面。

## 新增气体文件

将新文件放入 **GasFile/** 目录，然后在仓库根目录重新生成索引：

~~~bash
python3 tools/build_gas_index.py --pretty
~~~

检查 [GasFile/gas_index_report.md](GasFile/gas_index_report.md)，运行测试和一致性检查，然后提交新增文件和重新生成的索引：

~~~bash
python3 -m unittest discover -s tests -v
python3 tools/build_gas_index.py --check
git add GasFile tools tests .github README.md README.zh-CN.md gas_file_search.html
git commit -m "Update gas files and search index"
git push origin main
~~~

schema v2 索引在保留原始文本的同时，新增 **temperature_k**、**pressure_pa** 和 **pressure_atm** 标准数值字段，并记录气体比例总和、数据质量标记、数值匹配状态、文件大小和 SHA-256 内容校验值。

索引生成程序优先解析文件内部的 **Identifier:**，例如 **Ar 90%, CO2 10%, T=293.15 K, p=1 atm**。因此，即使文件命名不规则，也可以按照实际内容检索。无法完整解析的文件会记录在 [GasFile/gas_index_report.md](GasFile/gas_index_report.md) 中。特殊文件可以在 [GasFile/gas_metadata_override.json](GasFile/gas_metadata_override.json) 中修正，气体别名可以在 [GasFile/gas_aliases.json](GasFile/gas_aliases.json) 中维护。

GitHub Actions 会拒绝过期索引，并在更新进入 **main** 后发布验证通过的检索页面。
