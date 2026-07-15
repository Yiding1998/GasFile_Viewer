# GasFile_Viewer

[English](README.md) | [简体中文](README.zh-CN.md)

GasFile_Viewer 提供用于查看和检索 Garfield++ 气体文件的浏览器工具。本仓库包含气体文件集合、独立气体文件查看器，以及根据文件实际内容生成的数值检索索引。

[打开项目网页根入口](https://yiding1998.github.io/GasFile_Viewer/)时，程序会根据浏览器语言进入中文或英文工作台。

## 可用工具

- [快速使用说明：点击即用](QUICK_START.md#中文)：无需安装或配置，适合临时使用，可在文档内切换中英文。
- [直接打开 Garfield 气体文件工作台](https://yiding1998.github.io/GasFile_Viewer/garfield_gas_workbench_pro.html)：检索仓库气体文件，载入本地或索引文件，并进行比较、绘图、分析和数据导出。
- [下载中文单文件离线工作台](garfield_workbench_offline_zh.html)：只需保存这一个 HTML，双击打开后即可读取本地气体文件。
- [直接打开气体文件检索程序](https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html)：根据气体成分、比例、温度、压强、别名、标识符或路径检索气体文件，并按照参数接近程度排序。

## 使用 Garfield 气体文件工作台

### 通过 GitHub Pages 在线使用

点击以下链接即可直接打开网页程序：

[https://yiding1998.github.io/GasFile_Viewer/garfield_gas_workbench_pro.html](https://yiding1998.github.io/GasFile_Viewer/garfield_gas_workbench_pro.html)

气体文件工作台是一个浏览器应用。将一个或多个 **.gas** 文件拖入页面，或者通过文件选择器载入，即可查看和比较文件数据。在线版本无需安装软件，也无需启动本地网页服务器。

### 在工作台中检索并添加仓库文件

1. 点击 **搜索仓库气体文件**。
2. 按气体成分、比例、温度、压强、数据质量、别名或路径检索。
3. 查看 Garfield 版本、GASOK 可用位、E/p 范围、磁场范围、夹角范围、网格维度和文件大小。
4. 单独勾选结果，或使用 **选择前 3 个** / **选择前 5 个**。
5. 点击 **添加选中文件**，将文件载入原有工作台文件列表。

批量下载限制并发数量并支持取消。程序只允许读取索引中 **GasFile/** 目录下的文件；浏览器支持 Web Crypto 时，还会按照索引中的 SHA-256 校验下载内容。相同仓库路径或哈希的文件会自动跳过。保存完整项目时会保留仓库路径、哈希、索引时间和索引元数据。

独立检索页面的每条结果也提供 **English workbench** 和 **中文工作台** 操作，可以直接在指定语言界面中打开并添加文件。

### 使用输运参数作为横坐标

横坐标选择器除了三个电场坐标外，还包含当前纵坐标可用的全部内置输运参数和用户自定义派生参数。参数曲线默认保留原始电场扫描顺序，也可以切换为横坐标升序或仅显示数据点。公共网格和参考文件比较继续按照底层 E/p 对齐，避免对非单调参数进行错误反求。

工具提示、同步读数和 CSV 会保留每个点对应的 E、E/p、E/N、磁场和夹角。所选横坐标参数包含误差数据时，可以显示水平误差棒。绘图模板和完整项目会保存横坐标参数、点顺序及误差设置。

### 下载一个 HTML 离线使用

下载 [中文单文件离线工作台](garfield_workbench_offline_zh.html)，然后直接双击打开。无需安装程序、无需下载整个项目，也不需要额外的 JavaScript 文件；可选择或拖入一个或多个本地 `.gas` 文件，继续使用绘图、分析、导出和项目保存功能。

单文件离线版中的仓库检索受浏览器 `file://` 安全限制；检索 GitHub 仓库气体文件时请使用上面的 GitHub Pages 在线工作台。开发者应修改 [garfield_gas_workbench_pro.html](garfield_gas_workbench_pro.html) 和共享模块，再运行 `python3 tools/build_standalone_workbenches.py`，不要直接编辑生成的离线文件。

## 程序使用手册

源文档存放路径为：

**/ustcfs/STCFUser/yzhao/Simulation/Garfield/GasFile_Viewer/Doc**

在 GitHub 上也可以点击以下链接打开相应文档：

- [英文使用手册（Markdown）](Doc/Garfield_gas_workbench_pro_User_Manual_EN.md)
- [英文使用手册（PDF）](Doc/Garfield_gas_workbench_pro_User_Manual_EN.pdf)
- [中文使用手册（Markdown）](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.md)
- [中文使用手册（PDF）](Doc/Garfield_gas_workbench_pro_%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E.pdf)

## 项目与开发文档

- [项目结构与文件说明（简洁版）](Doc/%E9%A1%B9%E7%9B%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%96%87%E4%BB%B6%E8%AF%B4%E6%98%8E.md)：快速了解目录、主要文件、自动生成内容和常见维护入口。
- [代码设计与实现说明（详细版）](Doc/%E4%BB%A3%E7%A0%81%E8%AE%BE%E8%AE%A1%E4%B8%8E%E5%AE%9E%E7%8E%B0%E8%AF%B4%E6%98%8E.md)：详细说明索引、检索算法、工作台解析与绘图、数据格式、测试、部署和扩展方法。
- [English project structure guide](Doc/Project_Structure_and_File_Guide_EN.md)
- [English code design and implementation guide](Doc/Code_Design_and_Implementation_EN.md)

## 使用气体文件检索程序

### 通过 GitHub Pages 在线使用

GitHub Pages 配置完成后，可以直接访问：

[https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html](https://yiding1998.github.io/GasFile_Viewer/gas_file_search.html)

仓库已经包含[自动验证和发布工作流](.github/workflows/gas-search.yml)，每次发布前都会直接扫描 **GasFile/** 并重新生成索引。首次进入 **Settings -> Pages -> Source** 并选择 **GitHub Actions**，即可只保留一条发布路径。此后推送或上传到 **main** 的新气体文件会自动测试、建立索引并发布。

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

**Exact component set** 默认关闭，因此可以检索包含指定成分以及其他气体的混合物。用户按需要勾选后，结果才会排除含有额外气体成分的文件。

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
- 点击 **Refresh index** 加载最近一次成功部署的索引，同时保留当前检索条件。此操作只刷新浏览器数据，不会修改 GitHub 仓库文件。
- 复制包含当前检索条件的共享链接。
- 将当前结果导出为 CSV。
- 打开、下载、复制气体文件路径，或直接发送到中文/英文工作台。
- 预览 Garfield 版本、GASOK 可用位、E/p、磁场、夹角、网格和文件大小。
- 筛选可完整参与数值匹配的文件或存在数据警告的文件。

“最接近”仅用于帮助查找候选文件，并不表示该文件在物理上可以直接替代目标条件。用于模拟前，仍需检查文件中的电场范围、磁场、夹角和气体表覆盖范围。

普通用户不需要重新生成索引，只需使用最新版本的仓库或当前 GitHub Pages 页面。

## 新增气体文件

### 通过 GitHub 网页上传

仓库维护者无需在本地运行索引生成器：

1. 在 GitHub 中打开 **GasFile/** 目录。
2. 选择 **Add file -> Upload files**。
3. 上传新的 Garfield 气体文件并提交到 **main**。
4. 等待 **Gas search validation and Pages deployment** 工作流完成。
5. 打开检索页面并点击 **Refresh index**。

工作流会测试解析程序、扫描当前 **GasFile/**、生成全新的 schema v3 索引、执行一致性检查，并将生成后的索引随 GitHub Pages 一起发布。在线检索不要求事先更新仓库中的 **GasFile/gas_index.json**。

### 通过 Git 添加

~~~bash
git add GasFile/
git commit -m "Add gas files"
git push origin main
~~~

推送后，同一个工作流会自动重新生成并发布在线索引。维护者也可以进入 **Actions -> Gas search validation and Pages deployment -> Run workflow** 手动运行。

### 更新本地克隆的索引

部署工作流不会产生机器人自动提交。如果需要在本地克隆中检索刚新增的文件，请先重新生成本地索引：

~~~bash
python3 tools/build_gas_index.py --pretty
python3 tools/build_gas_index.py --check
~~~

文件存在警告时，应检查 [GasFile/gas_index_report.md](GasFile/gas_index_report.md)。schema v3 索引包含 **temperature_k**、**pressure_pa**、**pressure_atm**、比例总和、数据质量标记、数值匹配状态、文件大小、SHA-256、Garfield 格式版本、GASOK 位、网格维度，以及 E/p、磁场和夹角范围。

索引生成程序优先解析文件内部的 **Identifier:**，例如 **Ar 90%, CO2 10%, T=293.15 K, p=1 atm**。因此，即使文件命名不规则，也可以按照实际内容检索。特殊文件可以在 [GasFile/gas_metadata_override.json](GasFile/gas_metadata_override.json) 中修正，气体别名可以在 [GasFile/gas_aliases.json](GasFile/gas_aliases.json) 中维护。
