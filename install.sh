#!/bin/sh

set -e

# Momo-X installer

# check env
if { [ ! -x "/bin/opkg" ] && [ ! -x "/usr/bin/apk" ]; } || [ ! -x "/sbin/fw4" ]; then
	echo "only supports OpenWrt build with firewall4!"
	exit 1
fi

# include openwrt_release
. /etc/openwrt_release

# get branch/arch
arch="$DISTRIB_ARCH"
branch=
case "$DISTRIB_RELEASE" in
	*"24.10"*)
		branch="openwrt-24.10"
		;;
	*)
		echo "unsupported release: $DISTRIB_RELEASE, currently only OpenWrt 24.10 is published"
		exit 1
		;;
esac

if [ "$arch" != "x86_64" ]; then
	echo "unsupported architecture: $arch, currently only x86_64 is published"
	exit 1
fi

# feed url
repository_url="${MOMO_REPOSITORY_URL:-https://batxxx.github.io/OpenWrt-momo-x}"
feed_url="$repository_url/$branch/$arch/momo-x"

if [ -x "/bin/opkg" ]; then
	touch /etc/opkg/customfeeds.conf
	# add key
	echo "add key"
	key_build_pub_file="key-build.pub"
	wget -O "$key_build_pub_file" "$repository_url/key-build.pub"
	opkg-key add "$key_build_pub_file"
	rm -f "$key_build_pub_file"
	# add feed
	echo "add feed"
	for feed_conf in /etc/opkg/customfeeds.conf /etc/opkg/distfeeds.conf; do
		[ -f "$feed_conf" ] || continue
		sed -i '/src\/gz momo-x /d;/src\/gz momo /d;/OpenWrt-momo-x/d;/ghproxy.net.*momo/d' "$feed_conf"
	done
	echo "src/gz momo-x $feed_url" >> /etc/opkg/customfeeds.conf
	# update feeds
	echo "update feeds"
	opkg update
	# remove legacy pre-Momo-X packages before installing renamed packages
	if opkg list-installed momo momo-full momo-subconverter 2>/dev/null | grep -Eq '^(momo|momo-full|momo-subconverter) -'; then
		echo "remove legacy momo packages"
		for pkg in momo-full $(opkg list-installed luci-i18n-momo-* 2>/dev/null | cut -d ' ' -f 1) luci-app-momo momo-subconverter momo; do
			[ -n "$pkg" ] && opkg remove "$pkg" 2>/dev/null || true
		done
	fi
	# install packages from feed
	echo "install momo-x packages"
	opkg install momo-x momo-x-subconverter luci-app-momo luci-i18n-momo-zh-cn momo-x-full
elif [ -x "/usr/bin/apk" ]; then
	echo "apk-based firmware is detected, but the current public feed only publishes opkg/ipk packages"
	exit 1
fi

echo "success" 
