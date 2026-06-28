#!/bin/sh

. "$IPKG_INSTROOT/lib/functions.sh"
. "$IPKG_INSTROOT/etc/momo/scripts/include.sh"

config_load momo
config_get IPV4_URL proxy geoip_v4_url ""
config_get IPV6_URL proxy geoip_v6_url ""
config_get_bool BYPASS4 proxy bypass_china_mainland_ip 0
config_get_bool BYPASS6 proxy bypass_china_mainland_ip6 0

# UCI value wins; env override second; baked-in default last.
[ -n "$IPV4_URL" ] || IPV4_URL="${MOMO_CHINA_IPV4_URL:-https://raw.githubusercontent.com/gaoyifan/china-operator-ip/ip-lists/china.txt}"
[ -n "$IPV6_URL" ] || IPV6_URL="${MOMO_CHINA_IPV6_URL:-https://raw.githubusercontent.com/gaoyifan/china-operator-ip/ip-lists/china6.txt}"

# China domain bypass no longer ships a local list: it is handled by sing-box's
# native remote rule_set (geosite-cn) which self-updates and is cached. This
# script only refreshes the firewall-layer China IP nft sets.

fetch() {
	curl -fsSL --connect-timeout 15 --retry 2 -m 120 "$1" -o "$2"
}

# CIDR list -> nft set file. Refuses to write when fewer than $min valid entries,
# so a truncated download can't clobber a good list.
write_nft() {
	local src="$1" dst="$2" set="$3" type="$4" min="$5" count
	count=$(grep -cE '^[0-9a-fA-F:.]+/[0-9]+$' "$src")
	if [ "$count" -lt "$min" ]; then
		log "Geo" "$set: only $count valid entries (< $min), keep existing list."
		return 1
	fi
	awk -v set="$set" -v type="$type" '
		BEGIN {
			print "#!/usr/sbin/nft -f\n";
			print "table inet momo {";
			print "\tset " set " {";
			print "\t\ttype " type;
			print "\t\tflags interval";
			print "\t\telements = {";
		}
		/^[0-9a-fA-F:.]+\/[0-9]+$/ {
			if (n++) printf ",\n";
			printf "\t\t\t%s", $0;
		}
		END {
			print "\n\t\t}";
			print "\t}";
			print "}";
		}
	' "$src" > "$dst"
	log "Geo" "$set: $count entries."
}

# Live-refresh the running set so cron updates apply without a service restart.
# Only when this family's bypass is active and the momo table exists.
reload_set() {
	local set="$1" src="$2" bypass="$3" elems
	[ "$bypass" = 1 ] || return 0
	nft list table inet momo > /dev/null 2>&1 || return 0
	# busybox has no `paste`; join CIDRs with awk into a comma list for one add-element.
	elems=$(awk '/^[0-9a-fA-F:.]+\/[0-9]+$/ { if (n++) printf ","; printf "%s", $0 }' "$src")
	[ -n "$elems" ] || return 0
	{ echo "flush set inet momo $set"; echo "add element inet momo $set { $elems }"; } | nft -f - 2>/dev/null
}

main() {
	prepare_files
	mkdir -p "$FIREWALL_DIR" "$TEMP_DIR"

	local ipv4 ipv6 nft4 nft6 failed
	ipv4="$TEMP_DIR/china-ipv4.txt"
	ipv6="$TEMP_DIR/china-ipv6.txt"
	nft4="$TEMP_DIR/geoip_cn.nft"
	nft6="$TEMP_DIR/geoip6_cn.nft"
	failed=0

	log "Geo" "Update China IPv4 list."
	if fetch "$IPV4_URL" "$ipv4" && write_nft "$ipv4" "$nft4" "china_ip" "ipv4_addr" 1000 && mv "$nft4" "$GEOIP_CN_NFT"; then
		reload_set "china_ip" "$ipv4" "$BYPASS4"
	else
		log "Geo" "China IPv4 update failed."
		failed=1
	fi

	log "Geo" "Update China IPv6 list."
	if fetch "$IPV6_URL" "$ipv6" && write_nft "$ipv6" "$nft6" "china_ip6" "ipv6_addr" 50 && mv "$nft6" "$GEOIP6_CN_NFT"; then
		reload_set "china_ip6" "$ipv6" "$BYPASS6"
	else
		log "Geo" "China IPv6 update failed."
		failed=1
	fi

	rm -f "$ipv4" "$ipv6" "$nft4" "$nft6"
	[ "$failed" = 0 ] && log "Geo" "China IP bypass rules updated." || log "Geo" "China IP bypass rules updated with errors."
	return "$failed"
}

main "$@"
