![GitHub License](https://img.shields.io/github/license/batxxx/OpenWrt-momo-x?style=for-the-badge&logo=github) ![GitHub Tag](https://img.shields.io/github/v/release/batxxx/OpenWrt-momo-x?style=for-the-badge&logo=github) ![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/batxxx/OpenWrt-momo-x/total?style=for-the-badge&logo=github) ![GitHub Repo stars](https://img.shields.io/github/stars/batxxx/OpenWrt-momo-x?style=for-the-badge&logo=github) [![Telegram](https://img.shields.io/badge/Telegram-gray?style=for-the-badge&logo=telegram)](https://t.me/nikkinikki_org)

中文 | [English](README.md)

# Momo

Momo 是一个在 OpenWrt 上运行 sing-box 透明代理的 LuCI 应用和服务包。它提供配置文件管理、订阅转换、可视化规则编辑、规则附加、Web 面板、透明代理防火墙、TUN、TPROXY 等功能。

## 环境要求

- OpenWrt >= 24.10
- Linux Kernel >= 5.13
- firewall4
- sing-box >= 1.12
- 可以访问 LuCI 的浏览器

推荐依赖：

- `ca-bundle`
- `curl`
- `firewall4`
- `ip-full`
- `kmod-inet-diag`
- `kmod-nft-socket`
- `kmod-nft-tproxy`
- `kmod-tun`

## 功能

- 支持 Redirect、TPROXY、TUN 的透明代理。
- 支持 IPv4/IPv6 DNS 劫持和 IPv4/IPv6 流量代理。
- 支持路由器自身代理和局域网设备访问控制。
- 支持配置文件上传、切换、删除、下载和代码编辑器。
- 支持远程订阅管理、流量信息显示、手动更新和自动更新。
- 支持将通用订阅转换为 sing-box 配置，包括本地 subconverter 服务。
- 支持可视化编辑路由规则和节点组。
- 支持规则附加模板，订阅更新后自动写入自定义规则。
- 支持 MetaCubeXD/YACD 等 Clash API Web 面板。
- 支持定时更新订阅、定时重启和日志管理。

## 安装

### 发布软件源

这个分支使用 GitHub Pages 发布软件源。

一次性设置：

1. 打开 GitHub 上的本仓库。
2. 进入 `Settings` -> `Pages`。
3. 将 `Build and deployment` -> `Source` 设置为 `GitHub Actions`。
4. 进入 `Settings` -> `Secrets and variables` -> `Actions`。
5. 添加 release 工作流需要的软件包签名 secrets：
   - `KEY_BUILD`
   - `KEY_BUILD_PUB`
   - `PRIVATE_KEY`
   - `PUBLIC_KEY`
6. 打开 `Actions` -> `release-packages` 并运行工作流。

工作流完成后，软件源会发布到：

```text
https://batxxx.github.io/OpenWrt-momo-x
```

当前 release 工作流发布的是 `openwrt-24.10` 的 `x86_64` 软件包。

### 从软件源安装

GitHub Pages 软件源发布成功后，先添加软件源，只需要运行一次：

```sh
wget -O - https://github.com/batxxx/OpenWrt-momo-x/raw/refs/heads/main/feed.sh | ash
```

安装软件包：

```sh
# opkg
opkg update
opkg install momo-full

# apk
apk update
apk add momo-full
```

### 从 Release 软件源安装

GitHub Pages 软件源发布成功后，可以使用安装脚本直接下载并安装最新软件包：

```sh
wget -O - https://github.com/batxxx/OpenWrt-momo-x/raw/refs/heads/main/install.sh | ash
```

### 使用 GitHub Actions 产物安装

如果软件源还没有发布，可以直接使用构建产物：

1. 打开本仓库的 `Actions`。
2. 运行 `build-packages` 工作流。
3. 下载生成的软件包 artifact。
4. 将 `.ipk` 或 `.apk` 软件包上传到路由器。
5. 手动安装：

```sh
# opkg 固件
opkg install momo-full_*.ipk

# apk 固件
apk add --allow-untrusted momo-full-*.apk
```

### 使用 OpenWrt SDK 编译

在 OpenWrt SDK 或完整 buildroot 中执行：

```sh
echo "src-git momo https://github.com/batxxx/OpenWrt-momo-x.git;main" >> feeds.conf.default
./scripts/feeds update momo
./scripts/feeds install -a -p momo

make package/momo/compile V=s
make package/luci-app-momo/compile V=s
```

编译后的软件包位于 `bin/packages/<architecture>/momo`。把软件包上传到路由器后安装：

```sh
# opkg 固件
opkg install momo-full_*.ipk

# apk 固件
apk add --allow-untrusted momo-full-*.apk
```

## 快速开始

1. 打开 LuCI，进入 `服务` -> `Momo`。
2. 打开 `订阅管理`。
3. 添加远程订阅：
   - 填写订阅名称。
   - 填写订阅链接。
   - 如果订阅不是 sing-box JSON，启用 `在线订阅转换`。
   - 选择本地 subconverter 或远程订阅转换服务。
   - 转换目标保持 `sing-box`。
   - 按需要选择订阅转换模板。
4. 点击该订阅的 `更新`。
5. 打开 `配置文件`。
6. 选择生成的订阅配置，点击 `切换`。
7. 回到 `插件配置`，启用 Momo，点击 `保存并应用`。
8. 点击 `打开 Web 面板` 进入 Clash API 面板。

## LuCI 页面说明

### 插件配置

该页面控制 Momo 服务状态和当前运行配置。

- `运行配置`：选择本地配置文件或订阅生成的配置文件。
- `重启服务`：完整重启 Momo 和 sing-box。
- `更新 Web 面板`：下载或刷新外部 Web 面板资源。
- `打开 Web 面板`：通过配置的 Clash API 端口打开面板。
- `定时重启`：使用预约或循环模式，不需要手写 Cron 表达式。
- `仅核心模式`：只启动 sing-box 核心，不注入 Momo 的透明代理混入配置，也不设置防火墙、TUN、TPROXY 劫持。普通透明代理场景不要开启。
- `高级运行配置`：procd 进程守护、资源限制、沙箱和 Go 运行环境。不了解时保持默认即可。

### 配置文件

配置文件页面管理这些文件：

- 本地配置：`/etc/momo/profiles`
- 订阅生成配置：`/etc/momo/subscriptions`
- 运行配置：`/etc/momo/run/config.json`

支持的操作：

- 上传 `.json`、`.yaml`、`.yml` 配置文件。
- 新建本地配置文件。
- 编辑本地配置和订阅生成配置，编辑器支持行号、自动换行和代码高亮。
- 保存 JSON 配置前自动校验。
- 切换当前运行配置。
- 删除本地配置或订阅生成配置文件。
- 查看只读运行配置。

`config.json` 是当前 sing-box 进程实际使用的运行配置，由 Momo 启动时生成。它用于查看和排障，不建议直接编辑。

### 订阅管理

该页面管理远程订阅。

重要字段：

- `订阅链接`：远程节点或订阅地址。
- `订阅信息链接`：可选，只用于拉取流量信息头；当流量信息地址与订阅地址不同时使用。
- `User-Agent`：下载订阅时使用的 UA。
- `在线订阅转换`：将常见通用订阅转换成 sing-box JSON。
- `订阅转换服务地址`：本地 subconverter 或远程 subconverter 兼容服务。
- `转换目标`：固定为 `sing-box`。
- `订阅转换模板`：转换服务使用的模板，模板可以提供完整分流规则。
- `筛选节点` / `排除节点`：按关键词筛选或排除节点。
- `优先更新远程订阅`：启动或切换时优先重新下载和转换订阅。
- `优先使用本地缓存`：如果已有上次生成的配置文件，优先直接使用；缓存不存在时再下载。

自动更新支持：

- 预约模式：选择每周日期和每天时间。
- 循环模式：选择 1 小时、24 小时等易读间隔。

### 混入配置

混入配置会在启动或重载时合并到当前选择的配置文件里。留空表示不覆盖原配置文件或订阅里的对应字段。

常见用途：

- 覆盖日志级别。
- 调整 DNS 策略和缓存行为。
- 启用或配置 NTP。
- 配置缓存文件。
- 配置外部 Clash API 面板路径、下载地址、API 监听地址和密钥。

### 规则配置

规则配置页面会读取现有配置文件，并把路由规则和节点组转换成可视化页面。

你可以：

- 选择指定配置文件进行查看。
- 编辑网站、域名、IP 匹配规则。
- 在规则组中新增或删除域名。
- 修改规则使用哪个出站或节点组。
- 编辑 selector/urltest 节点组和成员。
- 只有配置校验通过后才保存。

### 规则附加

规则附加模板保存在 UCI 中，并会在订阅更新后自动应用。它适合处理“订阅会变化，但我始终想追加自己的规则”的场景。

可用模式：

- `所有节点`：Momo 会在订阅更新后的配置中自动生成 `所有节点` selector 和 `所有节点 自动选择` urltest 组。selector 会包含自动选择、`DIRECT` 和所有实际节点。
- `自定义节点`：手动输入要使用的出站或节点组名称。

规则附加支持：

- 前置规则：插入订阅规则之前，适合强制优先匹配。
- 后置规则：插入订阅规则之后，适合作为兜底补充。
- 只保存模板。
- 保存并立即应用到指定配置文件。

### 代理配置

代理配置页面控制透明代理行为。

主要选项：

- 启用或禁用代理处理。
- 启用 IPv4/IPv6 DNS 劫持。
- 启用 IPv4/IPv6 流量代理。
- 选择 TCP 模式：Redirect、TPROXY 或 TUN。
- 选择 UDP 模式：TPROXY 或 TUN。
- 配置路由器自身代理访问控制。
- 配置局域网设备代理访问控制。
- 配置绕过端口、DSCP、FWMark 和保留 IP。
- 配置等待 TUN 设备的超时时间和检查间隔。

修改代理配置后，需要点击 `保存并应用` 或重启 Momo，让运行配置、nftables 规则和策略路由重新生成。

### 日志

日志页面显示 Momo 应用日志和 sing-box 核心日志。

可用于检查：

- 订阅更新结果。
- 订阅转换失败原因。
- sing-box 配置校验错误。
- 防火墙、nftables、TUN、TPROXY 启动结果。
- Web 面板更新结果。

## 订阅转换说明

Momo 可以使用本地 subconverter 服务。启用本地服务后，订阅转换不需要把订阅链接发送到公共转换服务。

当转换模板包含完整分流规则时，Momo 会优先保留模板里的规则。如果转换后的配置无法通过校验，Momo 会回退到节点列表兼容模式，尽量保证配置可启动。

## 排障

### Web 面板无法连接

检查：

- Momo 是否正在运行。
- 外部控制 API 监听地址是否正确，常见值为 `0.0.0.0:9090`。
- 面板地址是否使用路由器 IP，例如 `http://192.168.1.1:9090/ui/`。
- API 密钥是否与混入配置中的值一致。

### 订阅更新成功，但页面看起来还是旧的

LuCI 已经打开的页面可能缓存旧 JavaScript 模块。关闭当前 Momo 标签页重新打开，或者清理 LuCI 缓存：

```sh
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/uhttpd reload
```

### 配置无法启动

运行：

```sh
sing-box check -c /etc/momo/run/config.json
tail -n 100 /var/log/momo/app.log
tail -n 100 /var/log/momo/core.log
```

### 透明代理规则没有生效

检查：

```sh
nft list tables | grep momo
ip rule show
ip -6 rule show
```

然后确认 `代理配置` 中代理模式和 DNS 劫持已经启用。

## 服务命令

```sh
/etc/init.d/momo start
/etc/init.d/momo stop
/etc/init.d/momo restart
/etc/init.d/momo reload
/etc/init.d/momo update_subscriptions

/etc/init.d/momo-subconverter start
/etc/init.d/momo-subconverter stop
/etc/init.d/momo-subconverter restart
```

## 卸载并重置

```sh
wget -O - https://github.com/batxxx/OpenWrt-momo-x/raw/refs/heads/main/uninstall.sh | ash
```

## 编译

```sh
echo "src-git momo https://github.com/batxxx/OpenWrt-momo-x.git;main" >> feeds.conf.default
./scripts/feeds update momo
./scripts/feeds install -a -p momo
make package/momo/compile V=s
make package/luci-app-momo/compile V=s
```

编译后的软件包位于 `bin/packages/<architecture>/momo`。

## 工作原理

1. 选择本地配置或订阅生成配置。
2. 按需下载和转换订阅。
3. 将配置标准化为 sing-box JSON。
4. 应用混入配置。
5. 应用规则附加模板。
6. 使用 sing-box 校验配置。
7. 通过 procd 启动 sing-box。
8. 创建 nftables 规则和策略路由，实现透明代理。

## 贡献者

[![贡献者](https://contrib.rocks/image?repo=batxxx/OpenWrt-momo-x)](https://github.com/batxxx/OpenWrt-momo-x/graphs/contributors)
