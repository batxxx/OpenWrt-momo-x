![GitHub License](https://img.shields.io/github/license/batxxx/OpenWrt-momo-x?style=for-the-badge&logo=github) ![GitHub Tag](https://img.shields.io/github/v/release/batxxx/OpenWrt-momo-x?style=for-the-badge&logo=github) ![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/batxxx/OpenWrt-momo-x/total?style=for-the-badge&logo=github) ![GitHub Repo stars](https://img.shields.io/github/stars/batxxx/OpenWrt-momo-x?style=for-the-badge&logo=github) [![Telegram](https://img.shields.io/badge/Telegram-gray?style=for-the-badge&logo=telegram)](https://t.me/nikkinikki_org)

English | [中文](README.zh.md)

# Momo

Momo is a LuCI app and service package for running sing-box transparent proxy on OpenWrt. It provides profile management, subscription conversion, visual rule editing, rule append templates, dashboard access, and firewall/TUN/TPROXY integration.

## Requirements

- OpenWrt >= 24.10
- Linux kernel >= 5.13
- firewall4
- sing-box >= 1.12
- A browser that can access LuCI

Recommended packages:

- `ca-bundle`
- `curl`
- `firewall4`
- `ip-full`
- `kmod-inet-diag`
- `kmod-nft-socket`
- `kmod-nft-tproxy`
- `kmod-tun`

## Features

- Transparent proxy with Redirect, TPROXY, and TUN modes.
- IPv4 and IPv6 DNS hijacking and traffic proxying.
- Router and LAN access control.
- Profile upload, switch, delete, download, and code editor.
- Remote subscription management with traffic information and manual/automatic updates.
- Subscription conversion to sing-box, including local subconverter support.
- Visual route-rule and outbound group editing.
- Rule append templates that are applied after subscription updates.
- Web dashboard integration for MetaCubeXD/YACD-compatible Clash API UI.
- Scheduled subscription update, scheduled restart, and log management.

## Installation

### Published Packages

This fork publishes installable packages in two places:

- GitHub Pages package feed, recommended for normal installation.
- GitHub Releases, useful when you want to download the `.ipk` files directly.

The current public feed is:

```text
https://batxxx.github.io/OpenWrt-momo-x/openwrt-24.10/x86_64/momo/
```

The current release workflow publishes `OpenWrt 24.10` packages for `x86_64`.
When manually running `Actions` -> `release-packages`, set `release_tag` to the version you want to publish, for example `v1.2.3`.

### One-Command Install

For supported systems, run:

```sh
wget -O - https://github.com/batxxx/OpenWrt-momo-x/raw/refs/heads/main/install.sh | ash
```

This script adds the package signing key, adds the GitHub Pages feed, updates the package index, and installs `momo-full`.

### Manual Feed Install

To add the feed without installing immediately, run:

```sh
wget -O - https://github.com/batxxx/OpenWrt-momo-x/raw/refs/heads/main/feed.sh | ash
```

Install packages:

```sh
# opkg
opkg update
opkg install momo-full

# apk
apk update
apk add momo-full
```

### Install From GitHub Releases

If you need the raw package files, download them from the Releases page:

1. Open `Releases` in this repository.
2. Download the package files for `openwrt-24.10 x86_64`.
3. Copy the `.ipk` packages to the router.
4. Install them manually:

```sh
opkg install momo-full_*.ipk
```

### Install From GitHub Actions Artifacts

If a release has not been published yet, use the workflow artifact directly:

1. Open `Actions` in this repository.
2. Run the `release-packages` workflow.
3. Download the generated `feed_momo_x86_64-openwrt-24.10` artifact.
4. Copy the `.ipk` or `.apk` packages to the router.
5. Install them manually:

```sh
# opkg firmware
opkg install momo-full_*.ipk

# apk firmware
apk add --allow-untrusted momo-full-*.apk
```

### Build With OpenWrt SDK

In an OpenWrt SDK or buildroot:

```sh
echo "src-git momo https://github.com/batxxx/OpenWrt-momo-x.git;main" >> feeds.conf.default
./scripts/feeds update momo
./scripts/feeds install -a -p momo

make package/momo/compile V=s
make package/luci-app-momo/compile V=s
```

The generated packages are under `bin/packages/<architecture>/momo`. Copy them to the router and install them:

```sh
# opkg firmware
opkg install momo-full_*.ipk

# apk firmware
apk add --allow-untrusted momo-full-*.apk
```

## Quick Start

1. Open LuCI and go to `Services` -> `Momo`.
2. Open `Subscription Management`.
3. Add a remote subscription:
   - Enter a subscription name.
   - Enter the subscription URL.
   - Enable `Online Subscription Conversion` when the subscription is not already sing-box JSON.
   - Select the local subconverter service or a remote conversion service.
   - Keep the target as `sing-box`.
   - Choose a conversion template if needed.
4. Click `Update` for the subscription.
5. Open `Profile`.
6. Select the generated subscription profile and click `Switch`.
7. Go back to `App Config`, enable Momo, and click `Save & Apply`.
8. Use `Open Web Dashboard` to access the Clash API dashboard.

## LuCI Pages

### App Config

This page controls the service status and runtime profile.

- `Run Profile`: choose a local profile or a subscription-generated profile.
- `Restart Service`: fully restarts Momo and sing-box.
- `Update Web Dashboard`: downloads or refreshes the external dashboard assets.
- `Open Web Dashboard`: opens the dashboard through the configured Clash API port.
- `Scheduled Restart`: uses user-friendly appointment or interval controls instead of raw cron expressions.
- `Core Only Mode`: starts only sing-box and does not inject Momo's transparent proxy mixin, firewall, TUN, or TPROXY rules. Keep it disabled for normal transparent proxy use.
- `Advanced Runtime Config`: procd process management, resource limits, sandbox, and Go runtime environment. Keep defaults unless you know you need these controls.

### Profile

The profile page manages files under:

- Local profiles: `/etc/momo/profiles`
- Subscription-generated profiles: `/etc/momo/subscriptions`
- Runtime profile: `/etc/momo/run/config.json`

Supported actions:

- Upload local `.json`, `.yaml`, or `.yml` profiles.
- Create a new local profile.
- Edit local or subscription-generated profiles with line numbers, wrapping, and syntax highlighting.
- Validate JSON profiles before saving.
- Switch the active runtime profile.
- Delete local or generated profile files.
- View the read-only runtime profile.

`config.json` is the generated runtime profile used by the running sing-box process. It is shown for inspection and should not be edited directly.

### Subscription Management

This page manages remote subscriptions.

Important fields:

- `Subscription URL`: the remote node/subscription URL.
- `Subscription Info URL`: an optional URL used only to fetch traffic usage headers when it differs from the subscription URL.
- `User-Agent`: the user agent used when downloading the subscription.
- `Online Subscription Conversion`: converts common subscription formats into sing-box JSON.
- `Conversion Service`: local subconverter or a remote subconverter-compatible service.
- `Conversion Target`: fixed to `sing-box`.
- `Conversion Template`: template used by the converter. Templates can provide complete routing rules.
- `Filter Nodes` / `Exclude Nodes`: keyword filters for included or excluded nodes.
- `Prefer Remote Subscription`: download and convert again when starting or switching.
- `Prefer Local Cache`: reuse the previously generated profile when available.

Automatic updates support:

- Appointment mode: choose weekday and time.
- Interval mode: choose a friendly interval such as 1 hour or 24 hours.

### Mixin Config

Mixin settings are merged into the selected profile at runtime. Leaving a field empty means Momo will not override that field from the original profile.

Common uses:

- Override log level.
- Adjust DNS strategy and cache behavior.
- Enable NTP settings.
- Configure cache file behavior.
- Configure the external Clash API dashboard path, download URL, API listen address, and secret.

### Rule Config

The rule page reads an existing profile and presents route rules and outbound groups visually.

You can:

- Select a profile to inspect.
- Edit website/domain/IP matching rules.
- Add or remove domains from a rule group.
- Change which outbound or node group a rule uses.
- Edit selector/urltest groups and their members.
- Save the edited profile only after validation passes.

### Rule Append

Rule append templates are stored in UCI and applied after subscription updates. This is useful when a subscription may change but you always want to add your own rules afterward.

Available modes:

- `All Nodes`: Momo automatically creates a selector named `All Nodes` and a urltest group named `All Nodes Auto Select` from whatever nodes exist after the subscription update. The selector also includes `DIRECT`.
- `Custom Node`: manually enter the outbound or node-group name to use.

Rule append supports:

- Prepend rules: inserted before subscription rules, useful for priority overrides.
- Append rules: inserted after subscription rules, useful as fallback additions.
- Save template only.
- Save and apply immediately to a selected profile.

### Proxy Config

This page controls transparent proxy behavior.

Main options:

- Enable or disable proxy handling.
- Enable IPv4/IPv6 DNS hijacking.
- Enable IPv4/IPv6 proxying.
- Select TCP mode: Redirect, TPROXY, or TUN.
- Select UDP mode: TPROXY or TUN.
- Configure router-self proxy access control.
- Configure LAN proxy access control.
- Configure bypass ports, DSCP, FWMark, and reserved IP ranges.
- Configure TUN device wait timeout and interval.

After changing proxy settings, use `Save & Apply` or restart Momo so the runtime profile, nftables rules, and policy routes are regenerated.

### Log

The log page shows Momo app logs and sing-box core logs.

Use it to check:

- Subscription update results.
- Profile conversion failures.
- sing-box validation errors.
- Firewall/nftables/TUN/TPROXY startup results.
- Dashboard update results.

## Subscription Conversion Notes

Momo can use a local subconverter service when installed and enabled. This avoids sending subscription URLs to a public conversion service.

When a conversion template contains full routing rules, Momo tries to preserve those rules. If the converted profile cannot pass validation, Momo falls back to a node-list compatible mode to keep the profile usable.

## Troubleshooting

### Web dashboard cannot connect

Check:

- Momo is running.
- The external control API listen address is configured, commonly `0.0.0.0:9090`.
- The dashboard URL uses the router IP, for example `http://192.168.1.1:9090/ui/`.
- The API secret matches the value in Mixin Config.

### Subscription update succeeds but the page still looks old

LuCI can cache JavaScript modules in an already-open page. Close the current Momo tab and reopen it, or clear LuCI cache:

```sh
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/uhttpd reload
```

### Profile does not start

Run:

```sh
sing-box check -c /etc/momo/run/config.json
tail -n 100 /var/log/momo/app.log
tail -n 100 /var/log/momo/core.log
```

### Proxy rules are not active

Check:

```sh
nft list tables | grep momo
ip rule show
ip -6 rule show
```

Then confirm that proxy mode and DNS hijack are enabled in `Proxy Config`.

## Service Commands

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

## Uninstall and Reset

```sh
wget -O - https://github.com/batxxx/OpenWrt-momo-x/raw/refs/heads/main/uninstall.sh | ash
```

## Build

```sh
echo "src-git momo https://github.com/batxxx/OpenWrt-momo-x.git;main" >> feeds.conf.default
./scripts/feeds update momo
./scripts/feeds install -a -p momo
make package/momo/compile V=s
make package/luci-app-momo/compile V=s
```

Package files will be generated under `bin/packages/<architecture>/momo`.

## How It Works

1. Select a local profile or subscription profile.
2. Download and convert the subscription when needed.
3. Normalize the profile into sing-box JSON.
4. Apply mixin settings.
5. Apply rule append templates.
6. Validate the profile with sing-box.
7. Start sing-box through procd.
8. Create nftables rules and policy routes for transparent proxying.

## Contributors

[![Contributors](https://contrib.rocks/image?repo=batxxx/OpenWrt-momo-x)](https://github.com/batxxx/OpenWrt-momo-x/graphs/contributors)
