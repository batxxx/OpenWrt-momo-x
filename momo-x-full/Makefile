include $(TOPDIR)/rules.mk

PKG_NAME:=momo-x-full
PKG_VERSION:=2026.06.03
PKG_RELEASE:=10

PKG_LICENSE:=GPL-3.0+
PKG_MAINTAINER:=Joseph Mory <morytyann@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/momo-x-full
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Complete Momo-X installation entry package
  URL:=https://github.com/batxxx/OpenWrt-momo-x
  EXTRA_DEPENDS:=momo-x, momo-x-subconverter, luci-app-momo, luci-i18n-momo-zh-cn
  CONFLICTS:=momo-full
  PKGARCH:=all
endef

define Package/momo-x-full/description
  Meta package for installing Momo-X service, local subconverter, LuCI app,
  and Chinese translation.
endef

define Build/Compile
endef

define Package/momo-x-full/install
	$(INSTALL_DIR) $(1)/usr/share/doc/momo-x-full
	echo "Momo-X full installation entry package." > $(1)/usr/share/doc/momo-x-full/README
endef

$(eval $(call BuildPackage,momo-x-full))
