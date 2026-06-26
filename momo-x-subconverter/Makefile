include $(TOPDIR)/rules.mk

PKG_NAME:=momo-x-subconverter
PKG_VERSION:=0.9.9
PKG_RELEASE:=1

PKG_SOURCE:=subconverter_linux64.tar.gz
PKG_SOURCE_URL:=https://github.com/asdlokj1qpi233/subconverter/releases/download/v$(PKG_VERSION)
PKG_HASH:=b9d6f969300d3c8398f9d970db7436274df0ff3e7c91d935d26bbd79fafc8488
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

PKG_LICENSE:=GPL-3.0
PKG_MAINTAINER:=batxxx

include $(INCLUDE_DIR)/package.mk

define Package/momo-x-subconverter
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Local subconverter service files for Momo-X
  URL:=https://github.com/asdlokj1qpi233/subconverter
  EXTRA_DEPENDS:=momo-x
  CONFLICTS:=momo-subconverter
endef

define Package/momo-x-subconverter/description
  Installs the local subconverter binary and resources used by Momo-X.
endef

define Build/Compile
endef

define Build/Prepare
	$(RM) -r $(PKG_BUILD_DIR)
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/source
	tar -xzf $(DL_DIR)/$(PKG_SOURCE) -C $(PKG_BUILD_DIR)/source --strip-components=1
endef

define Package/momo-x-subconverter/install
	$(INSTALL_DIR) $(1)/etc/momo/subconverter
	$(CP) $(PKG_BUILD_DIR)/source/. $(1)/etc/momo/subconverter/
	chmod +x $(1)/etc/momo/subconverter/subconverter
endef

define Package/momo-x-subconverter/postinst
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

define Package/momo-x-subconverter/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -x /etc/init.d/momo-subconverter ] && /etc/init.d/momo-subconverter stop 2>/dev/null || true
exit 0
endef

$(eval $(call BuildPackage,momo-x-subconverter))
