include $(TOPDIR)/rules.mk

PKG_NAME:=momo-full
PKG_VERSION:=2026.06.03
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0+
PKG_MAINTAINER:=Joseph Mory <morytyann@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/momo-full
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Complete Momo installation entry package
  URL:=https://github.com/batxxx/OpenWrt-momo-x
  DEPENDS:=+momo +momo-subconverter +luci-app-momo +luci-i18n-momo-zh-cn
  PKGARCH:=all
endef

define Package/momo-full/description
  Meta package for installing Momo service, local subconverter, LuCI app,
  and Chinese translation.
endef

define Build/Compile
endef

define Package/momo-full/install
	$(INSTALL_DIR) $(1)/usr/share/doc/momo-full
	echo "Momo full installation entry package." > $(1)/usr/share/doc/momo-full/README
endef

$(eval $(call BuildPackage,momo-full))
