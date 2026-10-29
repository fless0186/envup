# envup

**一份清单，一条命令：先确认这台机器能不能跑这个项目，不能就把它修好。**

[![npm](https://img.shields.io/npm/v/envup?color=cb3837&logo=npm)](https://www.npmjs.com/package/envup)
[![node](https://img.shields.io/node/v/envup?color=5fa04e&logo=node.js)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/fless0186/envup/actions/workflows/ci.yml/badge.svg)](https://github.com/fless0186/envup/actions/workflows/ci.yml)

`envup` 读取项目里的一个 `envup.json`，逐项检查工具链是否齐备、版本是否够新，再用你机器上
**已有** 的包管理器（`winget`、`brew`、`apt`、`dnf`、`pacman`、`scoop`、`choco`、`npm`）把缺的装上。

不需要守护进程、不需要容器、不绑定任何版本管理器，**运行时零依赖**。

```console
$ envup check
  envup check · acme-web

  ✓  node    24.22.1   >=20
  ✓  python  3.13.17   >=3.11
  ✗  go      —         >=1.22
        not found on PATH
  ✗  docker  —         >=24
        not found on PATH

  2 ok · 2 missing
  next  envup install go docker
```

---

## 它解决什么

新人上手文档会过期。一句"装 Node 20+ 和 Python 3.11"，最后总是变成半小时的排错，而且失败
永远是这三种样子：

- 工具根本没装；
- 装了，但**版本不够**；
- 装了，也够新，但**不在 `PATH` 里**（Windows 和 WSL 的经典坑）。

`envup` 把这三件事压成一条命令和一个确定的退出码，于是同一份检查可以跑在笔记本上、Dockerfile
里和 CI 里。

## 快速开始

```console
$ npx envup init      # 扫描仓库，生成 envup.json
$ npx envup check     # 对照检查这台机器
$ npx envup install   # 把缺的装上
```

`init` 只读项目里本来就有的声明：`package.json` 的 `engines` / `packageManager`、`.nvmrc`、
`pyproject.toml`、`go.mod`、`Cargo.toml`、`pom.xml`、`build.gradle`、`global.json`、`Gemfile`、
`composer.json`、`Dockerfile`、`.tool-versions` 以及各类 lockfile，并告诉你每条要求来自哪个文件：

```console
$ envup init
  envup init · acme-web

  ✓  node    >=20      package.json engines.node
  ✓  pnpm    >=9.12.0  package.json packageManager
  ✓  python  >=3.11    pyproject.toml requires-python
  ✓  go      >=1.22    go.mod
  ✓  git     >=2.30    .git
  ✓  docker  >=24      Dockerfile / compose file

  created /home/ana/acme-web/envup.json
  next  envup check
```

## 安装

```bash
npm install -g envup     # 全局
npx envup --help         # 或者直接用，不安装
```

需要 Node.js 20+。支持 Windows、macOS、Linux（含 WSL）。

## 命令

| 命令 | 作用 |
| --- | --- |
| `envup check [dir]` | 按 `envup.json` 校验全部工具，默认命令 |
| `envup install [dir]` | 生成并执行缺失工具的安装命令 |
| `envup init [dir]` | 探测工具链并写出 `envup.json` |
| `envup doctor` | 诊断机器本身：`PATH` 健康度、重复二进制、包管理器 |
| `envup add <tool>[@range]…` | 不改 JSON 也能加要求 |
| `envup remove <tool>…` | 删除要求 |

常用参数：

| 参数 | 作用 |
| --- | --- |
| `--json` | 输出机器可读结果，适合 CI 和脚本 |
| `--only node,python` | 只检查/安装指定工具 |
| `--strict` | 把"版本读不出来"这类警告升级为失败 |
| `--dry-run` | 只打印安装命令，不执行 |
| `--yes` / `-y` | 跳过确认 |
| `--sudo` | 允许执行需要提权的命令（Debian 系） |
| `--verbose` | 显示每个工具解析到的路径 |
| `--quiet` / `-q` | 只打一行摘要 |
| `--no-color`、`--ascii` | 纯文本输出，适配日志和老终端 |

退出码：**0** 全部满足 · **1** 有缺失或版本不符 · **2** 用法或配置错误。

## 清单格式

```json
{
  "$schema": "https://raw.githubusercontent.com/fless0186/envup/main/envup.schema.json",
  "name": "acme-web",
  "tools": {
    "node": ">=20",
    "pnpm": ">=9.12.0",
    "python": { "range": ">=3.11", "bin": "python3" }
  }
}
```

- `name`：可选，默认取目录名。
- `tools`：工具 id → 版本范围。字符串写法等价于"这个范围 + 默认可执行文件名"。

envup 不认识的工具，补一个 `bin` 就能用：

```json
{
  "tools": {
    "ripgrep": {
      "bin": "rg",
      "range": ">=13",
      "versionArgs": ["--version"],
      "versionPattern": "(\\d+\\.\\d+\\.\\d+)"
    }
  }
}
```

`versionPattern` 必须把版本放在第 1 个捕获组；`bin` 支持数组（如 `["python3", "python", "py"]`）。

## 版本范围

semver 的一个务实子集——够表达真实要求，又足够可预测：

| 写法 | 含义 |
| --- | --- |
| `any`、`*`、`""` | 装了就行 |
| `20.11.1` | 精确等于 |
| `20.11` / `20.11.x` | `>=20.11.0 <20.12.0` |
| `20` / `20.x` | `>=20.0.0 <21.0.0` |
| `^20.11.0` | `>=20.11.0 <21.0.0`（`0.x` 时锁次版本） |
| `~3.11` | `>=3.11.0 <3.12.0` |
| `>=3.11 <4` | 上下界同时成立 |

多个区间用双竖线并列：`>=20 || >=22` 表示两条线满足其一即可。

预发布版本的比较也符合直觉（正式版高于自己的预发布版）。

## 内置工具

| ID | 默认 | ID | 默认 |
| --- | --- | --- | --- |
| `node` | `>=20` | `go` | `>=1.22` |
| `npm` | `>=10` | `rustc` | `>=1.75` |
| `pnpm` | `>=9` | `cargo` | `>=1.75` |
| `yarn` | `>=1` | `java` | `>=17` |
| `bun` | `>=1` | `dotnet` | `>=8` |
| `deno` | `>=1` | `git` | `>=2.30` |
| `python` | `>=3.10` | `docker` | `>=24` |
| `pip` | `>=23` | `make` | `>=4` |
| `uv` | `>=0.4` | `gcc` | `>=11` |
| `poetry` | `>=1.8` | `cmake` | `>=3.20` |
| `php` | `>=8.1` | `ruby` | `>=3.1` |
| `sqlite3` | `>=3.35` | `psql` | `>=15` |

也支持别名（`golang` → `go`、`nodejs` → `node`、`py` → `python`）。其它工具用自定义 `bin` 即可。

## 在 CI 里用

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx envup check --strict
```

脚本里直接吃 JSON：

```console
$ envup check --json
{
  "schemaVersion": 1,
  "name": "acme-web",
  "manifest": "/repo/envup.json",
  "ok": false,
  "summary": { "total": 4, "ok": 2, "missing": 2, "mismatch": 0, "unknown": 0 },
  "tools": [
    { "id": "go", "range": ">=1.22", "status": "missing", "found": null, "path": null, "custom": false }
  ]
}
```

## 它不会做什么

- **不偷偷安装**：`install` 先打印确切命令再确认，`--dry-run` 到此为止；非交互环境不加 `--yes` 直接拒绝执行。
- **不自动 `sudo`**：需要提权的命令必须显式 `--sudo` 才跑。
- **不改 `PATH`、不动 shell 配置、不碰全局版本管理器状态**。
- **不联网、不埋点**：版本探测只运行本地二进制。
- **不需要 `git`**：检测完全基于文件系统。

## 实现要点

1. 解析并校验 `envup.json`；
2. 在 `PATH` 上解析可执行文件——Windows 下按目录列出并忽略大小写匹配，顺带绕开了
   Windows 应用别名导致的 `stat` 失败；
3. 询问工具版本，取输出里第一个版本号，用上面的范围语法比较；
4. `install` 把缺失项映射到本机可用的包管理器，且优先走工具自己的生态（有 npm 时 pnpm 走 npm）。

刻意处理的边角：Windows 的 `.cmd` 批处理转发、JSON 的 UTF-8 BOM、`python.exe` 商店别名、
Homebrew 的 `--cask`、以及禁止匿名管道的环境（自动退回文件捕获）。

## 已知限制

- 只检查你指定的目录；monorepo 请按包分别运行。
- 版本来自 stdout/stderr 文本，读不出就标记为 `unknown`（`--strict` 下算失败）。
- 安装不会修正"旧版本还在 `PATH` 前面"的情况，`envup doctor` 会指出来。

## 编程接口

```js
import { checkEnvironment } from 'envup';

const { summary, results } = await checkEnvironment({ dir: process.cwd() });
if (summary.missing > 0) process.exit(1);
```

同时导出 `parseManifest`、`scanProject`、`planInstall`、`detectManagers` 与版本比较函数。

## 路线图

- `envup lock`：锁住通过检查的精确版本，让 CI 和本地一致。
- `init` 的 monorepo 模式（workspace 发现）。
- Homebrew tap 与独立二进制。

## 参与

欢迎提 bug、加工具、补版本范围的边界用例——见 [CONTRIBUTING.md](CONTRIBUTING.md)。
新增工具通常只需要在 `src/core/registry.js` 里加一个对象，仓库刻意保持零运行时依赖。

English README: [README.md](README.md)。

## 许可

[MIT](LICENSE) © envup contributors
