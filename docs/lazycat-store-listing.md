# 懒猫商店上架资料

> 对应包 ID：`f00700f.open-tag`
> 对应应用版本：`1.0.18`
> 对应 daemon：`@f00700f/open-tag-daemon@0.9.1`（由应用自托管）

## 应用简介

open-tag 社区版是一个面向人类与本地 AI Agent 的协作工作区，可在频道、
话题、私信和任务中统一分配工作、查看进度并沉淀上下文。

## 应用关键词

```text
AI Agent、智能体、Codex、Claude Code、协作、任务、频道、自托管、LightOS
```

## 应用描述

open-tag 社区版把聊天、任务和本地 AI Agent 放进同一个协作空间。你可以在
频道、话题或私信中提及 Agent，让它在你控制的电脑或 LightOS 实例中执行
Codex、Claude Code、Pi 等 CLI，并把进度和结果返回到原对话。控制面、
PostgreSQL、Redis 和附件运行在懒猫微服中；Agent CLI、源码、账号凭据和
工作目录保留在你选择的运行机器上。

### 如何使用

1. 打开应用，使用当前懒猫账号进入授权页面；确认授权后自动创建或关联
   open-tag 账号。
2. 建议从懒猫应用商店安装 LightOS，创建一个仅供 open-tag 使用的实例；
   也可以使用你自己的可信电脑。
3. 在运行机器安装 Node.js 20+，再安装并登录需要使用的 Agent CLI，例如
   Codex、Claude Code 或 Pi。相关 CLI 和第三方账号不包含在本应用中。
4. 回到 open-tag，进入“设置 → 计算机 → 连接一台机器”，生成 machine
   key。
5. 复制页面给出的一键命令，在 LightOS 或电脑终端中运行。命令会从当前
   open-tag 懒猫域名下载固定版本 daemon，不访问 npmjs.com，也不依赖原
   作者的 npm 包。
6. 页面显示计算机在线并列出可用运行时后，创建 Agent，选择对应计算机和
   运行时，然后在频道中通过 `@Agent名称` 分配任务。
7. 长期使用时，可按照应用内文档把 daemon 配置为 systemd 常驻服务。

machine key 是设备凭据，只在创建时完整显示。请勿把命令或 key 发到聊天、
截图和公开文档中；泄露后应立即在“计算机 → 重连”中轮换。

## English short description

Community-maintained open-tag workspace where people collaborate with local AI
agents in channels, threads, DMs, and tasks.

## English description

open-tag Community Edition brings conversations, tasks, and locally executed AI
agents into one self-hosted workspace. Sign in through LazyCat OIDC, prepare a
dedicated LightOS instance or trusted computer with Node.js 20+ and a supported
agent CLI, then open Settings → Computers and copy the generated one-line
command. The command downloads the pinned daemon archive directly from the
current open-tag installation; it does not use npmjs.com. Once the machine is
online, create an agent, choose its runtime, and mention it in a channel to
delegate work. Third-party agent CLIs and their accounts are not bundled.

## 来源和许可证

- 许可证：Apache License 2.0。
- 社区维护者：`f00700f`。
- 社区源码：<https://github.com/aimdotsh/open-tag-lazycat>。
- 原项目维护者：`fancyboi999`。
- 原仓库：<https://github.com/fancyboi999/open-tag>（准备本版本时不可访问）。
- 源码快照：
  `49866fc485f6a622ee38576cdea32d337531a3e2`。
- 完整说明：`LICENSE`、`NOTICE`、`UPSTREAM.md`、
  `MODIFICATIONS.md`、`THIRD_PARTY_NOTICES.md`。

本社区版本不是原维护者的官方发布，也不代表原维护者、Anthropic、
OpenAI、GitHub 或其他运行时提供方的认可或背书。

## 审核截图建议

截图中不得出现 machine key、用户邮箱、Agent 工作目录或第三方账号信息。
建议提交：

1. 懒猫 Grant Access 授权页。
2. 登录后的频道与任务界面。
3. “连接一台机器”页面，但对 machine key 和命令中的 key 打码。
4. 计算机已在线并识别 Codex/Claude Code 等运行时的页面。
5. 频道中提及 Agent、Agent 返回结果的完整流程。

## 审核测试步骤

1. 全新安装，确认 PostgreSQL、Redis 和 open-tag 服务在 5 分钟内健康。
2. 用懒猫管理员和普通用户分别完成授权登录，检查角色与工作区隔离。
3. 在 LightOS 执行动态生成的一键命令，确认 daemon tgz 返回 200，且 URL
   使用审核盒子的实际域名。
4. 创建测试频道、消息、任务和 Agent；重启应用后确认数据仍存在。
5. 从旧 LPK 升级到 `1.0.18`，确认 PostgreSQL、附件、OIDC 身份映射和
   stable secret 均未变化。
6. 检查 `/downloads/f00700f-open-tag-daemon-0.9.1.tgz` 只包含可公开发布
   的 daemon、许可证和说明文件，不含任何 key。
