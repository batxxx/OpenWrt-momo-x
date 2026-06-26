#!/bin/sh

# uninstall
if [ -x "/bin/opkg" ]; then
	opkg remove momo-x-full momo-full
	for pkg in $(opkg list-installed luci-i18n-momo-* | cut -d ' ' -f 1); do
		opkg remove "$pkg"
	done
	opkg remove luci-app-momo
	opkg remove momo-x-subconverter momo-subconverter
	opkg remove momo-x momo
elif [ -x "/usr/bin/apk" ]; then
	apk del momo-x-full momo-full
	for pkg in $(apk list --installed --manifest luci-i18n-momo-* | cut -d ' ' -f 1); do
		apk del "$pkg"
	done
	apk del luci-app-momo
	apk del momo-x-subconverter momo-subconverter
	apk del momo-x momo
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
elif [ -x "/usr/bin/apk" ]; then
	if grep -q momo /etc/apk/repositories.d/customfeeds.list; then
		sed -i '/momo/d' /etc/apk/repositories.d/customfeeds.list
	fi
	rm -f /etc/apk/keys/momo.pem
fi
