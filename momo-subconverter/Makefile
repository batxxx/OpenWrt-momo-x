include $(TOPDIR)/rules.mk

PKG_NAME:=momo-subconverter
PKG_VERSION:=0.9.0
PKG_RELEASE:=1

PKG_SOURCE:=subconverter_linux64.tar.gz
PKG_SOURCE_URL:=https://github.com/tindy2013/subconverter/releases/download/v$(PKG_VERSION)
PKG_HASH:=884a6d1168267eba076fcdd5171215bacf98c17948ab526e4cbbdcad5f7a0217
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

PKG_LICENSE:=GPL-3.0
PKG_MAINTAINER:=batxxx

include $(INCLUDE_DIR)/package.mk

define Package/momo-subconverter
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Local subconverter service files for Momo
  URL:=https://github.com/tindy2013/subconverter
  DEPENDS:=+momo
endef

define Package/momo-subconverter/description
  Installs the local subconverter binary and resources used by Momo.
endef

define Build/Compile
endef

define Package/momo-subconverter/install
	$(INSTALL_DIR) $(1)/etc/momo/subconverter
	if [ -d "$(PKG_BUILD_DIR)/subconverter" ]; then \
		$(CP) $(PKG_BUILD_DIR)/subconverter/. $(1)/etc/momo/subconverter/; \
	else \
		$(CP) $(PKG_BUILD_DIR)/. $(1)/etc/momo/subconverter/; \
	fi
	chmod +x $(1)/etc/momo/subconverter/subconverter
endef

define Package/momo-subconverter/postinst
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

define Package/momo-subconverter/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -x /etc/init.d/momo-subconverter ] && /etc/init.d/momo-subconverter stop 2>/dev/null || true
exit 0
endef

$(eval $(call BuildPackage,momo-subconverter))
