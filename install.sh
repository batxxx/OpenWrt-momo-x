#!/bin/sh

# Momo's installer

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
feed_url="$repository_url/$branch/$arch/momo"

if [ -x "/bin/opkg" ]; then
	# add key
	echo "add key"
	key_build_pub_file="key-build.pub"
	wget -O "$key_build_pub_file" "$repository_url/key-build.pub"
	opkg-key add "$key_build_pub_file"
	rm -f "$key_build_pub_file"
	# add feed
	echo "add feed"
	if grep -q momo /etc/opkg/customfeeds.conf; then
		sed -i '/momo/d' /etc/opkg/customfeeds.conf
	fi
	echo "src/gz momo $feed_url" >> /etc/opkg/customfeeds.conf
	# update feeds
	echo "update feeds"
	opkg update
	# install entry package from feed
	echo "install momo-full"
	opkg install momo-full
elif [ -x "/usr/bin/apk" ]; then
	# add key
	echo "add key"
	wget -O "/etc/apk/keys/momo.pem" "$repository_url/public-key.pem"
	# add feed
	echo "add feed"
	if grep -q momo /etc/apk/repositories.d/customfeeds.list; then
		sed -i '/momo/d' /etc/apk/repositories.d/customfeeds.list
	fi
	echo "$feed_url/packages.adb" >> /etc/apk/repositories.d/customfeeds.list
	# update feeds
	echo "update feeds"
	apk update
	# install entry package from feed
	echo "install momo-full"
	apk add --allow-untrusted -X $feed_url/packages.adb momo-full
fi

echo "success" 
