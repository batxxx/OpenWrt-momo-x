include $(TOPDIR)/rules.mk

PKG_NAME:=momo-x
PKG_VERSION:=2026.06.03
PKG_RELEASE:=11

PKG_LICENSE:=GPL-3.0+
PKG_MAINTAINER:=Joseph Mory <morytyann@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/momo-x
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Transparent Proxy with sing-box on OpenWrt.
  URL:=https://github.com/batxxx/OpenWrt-momo-x
  DEPENDS:=+ca-bundle +curl firewall4 +ip-full +kmod-inet-diag +kmod-nft-socket +kmod-nft-tproxy +kmod-tun +kmod-dummy
  EXTRA_DEPENDS:=sing-box
  CONFLICTS:=momo
endef

define Package/momo-x/conffiles
/etc/config/momo
endef

define Package/momo-x/install
	$(INSTALL_DIR) $(1)/etc/momo
	$(INSTALL_DIR) $(1)/etc/momo/ucode
	$(INSTALL_DIR) $(1)/etc/momo/scripts
	$(INSTALL_DIR) $(1)/etc/momo/firewall
	$(INSTALL_DIR) $(1)/etc/momo/profiles
	$(INSTALL_DIR) $(1)/etc/momo/subscriptions
	$(INSTALL_DIR) $(1)/etc/momo/subconverter
	$(INSTALL_DIR) $(1)/etc/momo/run
	$(INSTALL_DIR) $(1)/etc/capabilities

	$(CP) $(CURDIR)/files/subconverter/. $(1)/etc/momo/subconverter/

	$(INSTALL_BIN) $(CURDIR)/files/ucode/include.uc $(1)/etc/momo/ucode/include.uc
	$(INSTALL_BIN) $(CURDIR)/files/ucode/mixin.uc $(1)/etc/momo/ucode/mixin.uc
	$(INSTALL_BIN) $(CURDIR)/files/ucode/profile_normalize.uc $(1)/etc/momo/ucode/profile_normalize.uc
	$(INSTALL_BIN) $(CURDIR)/files/ucode/profile_rules.uc $(1)/etc/momo/ucode/profile_rules.uc
	$(INSTALL_BIN) $(CURDIR)/files/ucode/share_links_to_singbox.uc $(1)/etc/momo/ucode/share_links_to_singbox.uc
	$(INSTALL_BIN) $(CURDIR)/files/ucode/hijack.ut $(1)/etc/momo/ucode/hijack.ut

	$(INSTALL_BIN) $(CURDIR)/files/scripts/include.sh $(1)/etc/momo/scripts/include.sh
	$(INSTALL_BIN) $(CURDIR)/files/scripts/firewall_include.sh $(1)/etc/momo/scripts/firewall_include.sh
	$(INSTALL_BIN) $(CURDIR)/files/scripts/debug.sh $(1)/etc/momo/scripts/debug.sh

	$(INSTALL_BIN) $(CURDIR)/files/firewall/geoip_cn.nft $(1)/etc/momo/firewall/geoip_cn.nft
	$(INSTALL_BIN) $(CURDIR)/files/firewall/geoip6_cn.nft $(1)/etc/momo/firewall/geoip6_cn.nft
	$(INSTALL_DATA) $(CURDIR)/files/capabilities/momo.json $(1)/etc/capabilities/momo.json

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) $(CURDIR)/files/momo.conf $(1)/etc/config/momo

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/momo.init $(1)/etc/init.d/momo
	$(INSTALL_BIN) $(CURDIR)/files/momo-subconverter.init $(1)/etc/init.d/momo-subconverter

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) $(CURDIR)/files/uci-defaults/firewall.sh $(1)/etc/uci-defaults/99_firewall_momo
	$(INSTALL_BIN) $(CURDIR)/files/uci-defaults/init.sh $(1)/etc/uci-defaults/99_init_momo
	$(INSTALL_BIN) $(CURDIR)/files/uci-defaults/migrate.sh $(1)/etc/uci-defaults/99_migrate_momo

	$(INSTALL_DIR) $(1)/lib/upgrade/keep.d
	$(INSTALL_DATA) $(CURDIR)/files/momo.upgrade $(1)/lib/upgrade/keep.d/momo
endef

define Package/momo-x/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
if [ -x /etc/init.d/momo-subconverter ]; then
	/etc/init.d/momo-subconverter enable 2>/dev/null || true
	if [ "$$(uci -q get momo.local_subconverter.enabled)" = "1" ]; then
		/etc/init.d/momo-subconverter restart 2>/dev/null || true
	fi
fi
exit 0
endef

define Package/momo-x/postrm
#!/bin/sh
if [ -z $${IPKG_INSTROOT} ]; then
	uci -q batch <<-EOF > /dev/null
		del firewall.momo
		commit firewall
	EOF
fi
endef

define Build/Compile

endef

$(eval $(call BuildPackage,momo-x))
