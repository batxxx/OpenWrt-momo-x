#!/bin/sh

set -e

# Momo-X local installer
# Pulls the prebuilt .ipk packages from the self-hosted Forgejo release and
# installs them directly (no opkg signed feed needed).
#
# Usage on the OpenWrt router:
#   wget -O - http://10.168.10.119/forgejo-admin/momo/raw/branch/main/local-install.sh | sh
#
# Override host/repo if needed:
#   MOMO_FORGE_HOST=http://10.168.10.119 MOMO_FORGE_REPO=forgejo-admin/momo sh local-install.sh

HOST="${MOMO_FORGE_HOST:-http://10.168.10.119}"
REPO="${MOMO_FORGE_REPO:-forgejo-admin/momo}"
api="$HOST/api/v1/repos/$REPO/releases/latest"

# check env
if [ ! -x "/bin/opkg" ] || [ ! -x "/sbin/fw4" ]; then
	echo "only supports OpenWrt build with opkg + firewall4!"
	exit 1
fi

tmp="/tmp/momo-x-ipk"
rm -rf "$tmp"
mkdir -p "$tmp"

echo "fetch latest release from $api"
urls=$(wget -qO- "$api" | grep -o '"browser_download_url":"[^"]*\.ipk"' | sed 's/.*:"//;s/"$//')
[ -n "$urls" ] || { echo "no .ipk assets found in latest release"; exit 1; }

echo "download packages"
for u in $urls; do
	n=$(basename "$u")
	echo "  $n"
	wget -O "$tmp/$n" "$u"
done

# refresh official feeds for dependency resolution (don't hard-fail if offline)
opkg update || true

# remove legacy pre-Momo-X packages before installing renamed packages
if opkg list-installed momo momo-full momo-subconverter 2>/dev/null | grep -Eq '^(momo|momo-full|momo-subconverter) -'; then
	echo "remove legacy momo packages"
	for pkg in momo-full $(opkg list-installed 'luci-i18n-momo-*' 2>/dev/null | cut -d ' ' -f 1) luci-app-momo momo-subconverter momo; do
		[ -n "$pkg" ] && opkg remove "$pkg" 2>/dev/null || true
	done
fi

echo "install momo-x packages"
opkg install "$tmp"/*.ipk

rm -rf "$tmp"
echo "success"
