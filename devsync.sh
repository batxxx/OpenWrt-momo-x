#!/bin/sh
#
# devsync.sh - fast-iterate Momo-X by syncing the interpreted files (shell,
# ucode, LuCI JS, rpcd) from a git branch straight onto the router, skipping the
# ~15 min OpenWrt .ipk build.
#
# Usage on the router:
#   wget -O - https://github.com/batxxx/OpenWrt-momo-x/raw/main/devsync.sh | ash
#   # or pick a branch:  ... raw/main/devsync.sh | ash -s -- dev
#
# This is a DEV hot-patch, not a real upgrade: it bypasses opkg, so the version
# in `opkg list` stays unchanged and sysupgrade/conffile handling do not apply.
# It never overwrites /etc/config/momo (your live settings) - new UCI options
# are added idempotently via migrate.sh instead. The static geoip_cn nft lists
# are left untouched (they are refreshed by `update_geo_rules`, not code). For a
# real release to the feed, push to main and let the build workflow publish.

set -e

REPO="batxxx/OpenWrt-momo-x"
BRANCH="${1:-main}"
NAME="${REPO#*/}"
URL="https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH"
TMP="/tmp/momo-devsync.$$"

fetch() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$1" -o "$2"
	else
		wget -qO "$2" "$1"
	fi
}

echo "[devsync] downloading $REPO@$BRANCH ..."
mkdir -p "$TMP"
fetch "$URL" "$TMP/src.tar.gz"
tar -xzf "$TMP/src.tar.gz" -C "$TMP"
SRC="$TMP/$NAME-$BRANCH"
[ -d "$SRC" ] || SRC="$(echo "$TMP"/*-"$BRANCH" | head -n1)"
[ -d "$SRC/momo-x" ] || { echo "[devsync] extract failed"; rm -rf "$TMP"; exit 1; }

echo "[devsync] syncing momo-x code ..."
cp -f "$SRC"/momo-x/files/ucode/*.uc "$SRC"/momo-x/files/ucode/*.ut /etc/momo/ucode/
cp -f "$SRC"/momo-x/files/scripts/*.sh /etc/momo/scripts/
cp -f "$SRC"/momo-x/files/momo.init /etc/init.d/momo
cp -f "$SRC"/momo-x/files/momo-subconverter.init /etc/init.d/momo-subconverter
cp -f "$SRC"/momo-x/files/capabilities/momo.json /etc/capabilities/momo.json
cp -rf "$SRC"/momo-x/files/subconverter/config/. /etc/momo/subconverter/config/ 2>/dev/null || true
cp -rf "$SRC"/momo-x/files/subconverter/rules/. /etc/momo/subconverter/rules/ 2>/dev/null || true
chmod +x /etc/momo/ucode/* /etc/momo/scripts/*.sh /etc/init.d/momo /etc/init.d/momo-subconverter 2>/dev/null || true

echo "[devsync] syncing LuCI ..."
cp -rf "$SRC"/luci-app-momo/htdocs/luci-static/. /www/luci-static/
cp -rf "$SRC"/luci-app-momo/root/usr/share/. /usr/share/

echo "[devsync] adding any new UCI options ..."
sh "$SRC"/momo-x/files/uci-defaults/migrate.sh || true

echo "[devsync] reloading ..."
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/rpcd reload 2>/dev/null || true
/etc/init.d/momo restart

rm -rf "$TMP"
echo "[devsync] done - hot-patched from $BRANCH (opkg version unchanged)."
