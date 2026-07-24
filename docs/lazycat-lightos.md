# 在 LightOS 中连接 open-tag daemon

本文适用于 `f00700f` 维护的 open-tag 懒猫社区版。daemon 固定为
`@f00700f/open-tag-daemon@0.9.1`，由每个 open-tag 安装实例直接提供 tgz，
运行时不访问 npmjs.com。

open-tag 的 Web/API、PostgreSQL 和 Redis 运行在 LPK 中；真正执行 Codex、Claude Code 等 CLI 的 daemon 推荐运行在一个独立 LightOS 实例中。这样 CLI、凭据、源码和 Agent 工作区都能跨重启保留。

## 1. 准备 LightOS

1. 在懒猫应用商店安装 LightOS 入口。
2. 创建名为 `open-tag-runner` 的专用实例，只授权给可信管理员。
3. 在实例内安装 Node.js 20 或更新版本。
4. 安装并登录你要使用的 Agent CLI，例如 Codex、Claude Code 或 Pi。

不要把个人日常使用的 SSH 私钥或不受限的云 API Key 分享给其他用户。建议为这个实例使用专用凭据和独立代码目录。

## 2. 一键运行 daemon

```bash
sudo mkdir -p /opt/open-tag
sudo chown "$(id -u):$(id -g)" /opt/open-tag
```

在 open-tag 页面进入 **Settings → Computers → Connect a computer**，创建 machine key。页面会根据当前懒猫应用域名生成一条可直接复制的命令，例如：

```bash
OPEN_TAG_HOME=/opt/open-tag npx --yes --package="https://你的-open-tag-懒猫应用域名/downloads/f00700f-open-tag-daemon-0.9.1.tgz" -- open-tag-daemon --server-url "https://你的-open-tag-懒猫应用域名" --api-key sk_machine_xxxxxxxxx
```

页面显示计算机在线并列出已安装的 CLI 后，即表示连接成功。

machine key 只在生成时完整显示，它等同于设备登录凭据。不要把完整命令
粘贴到工单、聊天或商店截图中。如果命令曾经公开，请在
**设置 → 计算机 → 重连**中立即轮换，旧 key 会失效。

## 3. 配置常驻服务

常驻运行前先从同一个懒猫地址永久安装固定版本：

```bash
npm install -g "https://你的-open-tag-懒猫应用域名/downloads/f00700f-open-tag-daemon-0.9.1.tgz"
```

将 machine key 存入仅 root 可读的环境文件，例如 `/etc/open-tag-daemon.env`：

```text
OPEN_TAG_HOME=/opt/open-tag
OPEN_TAG_SERVER_URL=https://你的-open-tag-懒猫应用域名
OPEN_TAG_MACHINE_KEY=sk_machine_xxxxxxxxx
```

创建 `/etc/systemd/system/open-tag-daemon.service`：

```ini
[Unit]
Description=open-tag compute daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/open-tag-daemon.env
ExecStart=/usr/local/bin/open-tag-daemon --server-url ${OPEN_TAG_SERVER_URL} --api-key ${OPEN_TAG_MACHINE_KEY}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

不同 Node 安装方式可能把 `open-tag-daemon` 放在其他目录；先运行 `command -v open-tag-daemon`，必要时调整 `ExecStart`。最后执行：

```bash
sudo chmod 600 /etc/open-tag-daemon.env
sudo systemctl daemon-reload
sudo systemctl enable --now open-tag-daemon
sudo systemctl status open-tag-daemon
```

## 4. 备份

至少备份 `/opt/open-tag/agents`。LPK 侧还应定期备份 PostgreSQL 数据和 `/lzcapp/var/open-tag` 中的附件。

## 5. 许可证和来源

应用登录后可从 `/legal/LICENSE.txt`、`/legal/NOTICE.txt`、
`/legal/UPSTREAM.md`、`/legal/MODIFICATIONS.md` 和
`/legal/THIRD_PARTY_NOTICES.md` 读取许可证、来源、社区修改记录和第三方
许可证说明。社区源码仓库为
<https://github.com/aimdotsh/open-tag-lazycat>；原始仓库地址和源码快照标识
记录在 `UPSTREAM.md`。
