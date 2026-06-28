#!/bin/sh

. "$IPKG_INSTROOT/etc/momo/scripts/include.sh"

# since v1.0.2

section_placeholder=$(uci -q get momo.placeholder); [ -z "$section_placeholder" ] && uci set momo.placeholder="placeholder"

# since v1.1.0

proxy_bypass_china_mainland_ip=$(uci -q get momo.proxy.bypass_china_mainland_ip)
proxy_bypass_china_mainland_ip6=$(uci -q get momo.proxy.bypass_china_mainland_ip6)
[ -z "$proxy_bypass_china_mainland_ip6" ] && uci set momo.proxy.bypass_china_mainland_ip6=$proxy_bypass_china_mainland_ip

routing_tproxy_fw_mask=$(uci -q get momo.routing.tproxy_fw_mask); [ -z "$routing_tproxy_fw_mask" ] && uci set momo.routing.tproxy_fw_mask=0xFF
routing_tun_fw_mask=$(uci -q get momo.routing.tun_fw_mask); [ -z "$routing_tun_fw_mask" ] && uci set momo.routing.tun_fw_mask=0xFF

procd=$(uci -q get momo.procd); [ -z "$procd" ] && {
	uci set momo.procd=procd
	uci set momo.procd.fast_reload=$(uci -q get momo.config.fast_reload)
	uci del momo.config.fast_reload
}

# since v1.1.1

dummy_device=$(uci -q get momo.routing.dummy_device); [ -z "$dummy_device" ] && uci set momo.routing.dummy_device=momo-dummy

# since v1.1.2

config_scheduled_restart_cron=$(uci -q get momo.config.scheduled_restart_cron); [ -z "$config_scheduled_restart_cron" ] && uci rename momo.config.cron_expression="scheduled_restart_cron"
config_scheduled_restart_mode=$(uci -q get momo.config.scheduled_restart_mode); [ -z "$config_scheduled_restart_mode" ] && uci set momo.config.scheduled_restart_mode="appointment"
config_scheduled_restart_weekday=$(uci -q get momo.config.scheduled_restart_weekday); [ -z "$config_scheduled_restart_weekday" ] && uci set momo.config.scheduled_restart_weekday="*"
config_scheduled_restart_time=$(uci -q get momo.config.scheduled_restart_time); [ -z "$config_scheduled_restart_time" ] && uci set momo.config.scheduled_restart_time="03:00"
config_scheduled_restart_interval=$(uci -q get momo.config.scheduled_restart_interval); [ -z "$config_scheduled_restart_interval" ] && uci set momo.config.scheduled_restart_interval="1440"
config_subscription_scheduled_update=$(uci -q get momo.config.subscription_scheduled_update); [ -z "$config_subscription_scheduled_update" ] && uci set momo.config.subscription_scheduled_update=0
config_subscription_update_mode=$(uci -q get momo.config.subscription_update_mode); [ -z "$config_subscription_update_mode" ] && uci set momo.config.subscription_update_mode="appointment"
config_subscription_update_weekday=$(uci -q get momo.config.subscription_update_weekday); [ -z "$config_subscription_update_weekday" ] && uci set momo.config.subscription_update_weekday="*"
config_subscription_update_time=$(uci -q get momo.config.subscription_update_time); [ -z "$config_subscription_update_time" ] && uci set momo.config.subscription_update_time="04:00"
config_subscription_update_interval=$(uci -q get momo.config.subscription_update_interval); [ -z "$config_subscription_update_interval" ] && uci set momo.config.subscription_update_interval="60"

section_log=$(uci -q get momo.log); [ -z "$section_log" ] && {
	uci set momo.log=log
	uci set momo.log.scheduled_clear=1
	uci set momo.log.scheduled_clear_cron="*/5 * * * *"
	uci set momo.log.scheduled_clear_mode=cycle
	uci set momo.log.scheduled_clear_weekday="*"
	uci set momo.log.scheduled_clear_time="03:00"
	uci set momo.log.scheduled_clear_interval=5
	uci set momo.log.scheduled_clear_size_limit=1
	uci set momo.log.scheduled_clear_size_limit_unit=MB
}
log_scheduled_clear_mode=$(uci -q get momo.log.scheduled_clear_mode); [ -z "$log_scheduled_clear_mode" ] && uci set momo.log.scheduled_clear_mode=cycle
log_scheduled_clear_weekday=$(uci -q get momo.log.scheduled_clear_weekday); [ -z "$log_scheduled_clear_weekday" ] && uci set momo.log.scheduled_clear_weekday="*"
log_scheduled_clear_time=$(uci -q get momo.log.scheduled_clear_time); [ -z "$log_scheduled_clear_time" ] && uci set momo.log.scheduled_clear_time="03:00"
log_scheduled_clear_interval=$(uci -q get momo.log.scheduled_clear_interval); [ -z "$log_scheduled_clear_interval" ] && uci set momo.log.scheduled_clear_interval=5

section_mixin=$(uci -q get momo.mixin); [ -z "$section_mixin" ] && {
	uci set momo.mixin=mixin
	uci set momo.mixin.log_disabled='0'
	uci set momo.mixin.log_level='info'
	uci set momo.mixin.log_timestamp='1'
	uci add_list momo.mixin.dns_server='119.29.29.29'
	uci set momo.mixin.dns_fakeip='1'
	uci set momo.mixin.dns_independent_cache='1'
	uci set momo.mixin.dns_reverse_mapping='1'
	uci set momo.mixin.cache_enabled='1'
	uci set momo.mixin.cache_store_fakeip='1'
	uci set momo.mixin.cache_store_rdrc='1'
	uci set momo.mixin.external_control_ui_path='ui'
	uci set momo.mixin.external_control_ui_download_url='https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip'
}
mixin_dns_server=$(uci -q get momo.mixin.dns_server); [ -z "$mixin_dns_server" ] && uci add_list momo.mixin.dns_server='119.29.29.29'
mixin_dns_fakeip=$(uci -q get momo.mixin.dns_fakeip); [ -z "$mixin_dns_fakeip" ] && uci set momo.mixin.dns_fakeip='1'

# since v1.2.1
config_clear_at_stop=$(uci -q get momo.log.clear_at_stop); [ -z "$config_clear_at_stop" ] && uci set momo.log.clear_at_stop=1

# since v1.2.4
proxy_bypass_china_mainland_domain=$(uci -q get momo.proxy.bypass_china_mainland_domain); [ -z "$proxy_bypass_china_mainland_domain" ] && uci set momo.proxy.bypass_china_mainland_domain=0
proxy_bypass_geo_auto_update=$(uci -q get momo.proxy.bypass_geo_auto_update); [ -z "$proxy_bypass_geo_auto_update" ] && uci set momo.proxy.bypass_geo_auto_update=0
proxy_bypass_geo_update_interval=$(uci -q get momo.proxy.bypass_geo_update_interval); [ -z "$proxy_bypass_geo_update_interval" ] && uci set momo.proxy.bypass_geo_update_interval=weekly

# commit
uci commit momo

# exit with 0
exit 0
