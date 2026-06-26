#!/bin/sh

# uninstall
if [ -x "/bin/opkg" ]; then
	for pkg in $(opkg list-installed luci-i18n-momo-* | cut -d ' ' -f 1); do
		opkg remove "$pkg"
	done
	opkg remove luci-app-momo
	opkg remove momo-x-full momo-x-subconverter momo-x
	opkg remove momo-full momo-subconverter momo
elif [ -x "/usr/bin/apk" ]; then
	for pkg in $(apk list --installed --manifest luci-i18n-momo-* | cut -d ' ' -f 1); do
		apk del "$pkg"
	done
	apk del luci-app-momo
	apk del momo-x-full momo-x-subconverter momo-x
	apk del momo-full momo-subconverter momo
fi
# remove config
rm -f /etc/config/momo
# remove files
rm -rf /etc/momo
# remove log
rm -rf /var/log/momo
# remove temp
rm -rf /var/run/momo
# remove feed
if [ -x "/bin/opkg" ]; then
	if grep -q momo /etc/opkg/customfeeds.conf; then
		sed -i '/momo/d' /etc/opkg/customfeeds.conf
	fi
	wget -O "momo.pub" "${MOMO_REPOSITORY_URL:-https://batxxx.github.io/OpenWrt-momo-x}/key-build.pub"
	opkg-key remove momo.pub
	rm -f momo.pub
elif [ -x "/usr/bin/apk" ]; then
	if grep -q momo /etc/apk/repositories.d/customfeeds.list; then
		sed -i '/momo/d' /etc/apk/repositories.d/customfeeds.list
	fi
	rm -f /etc/apk/keys/momo.pem
fi
