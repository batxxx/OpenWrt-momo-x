#!/bin/sh

. "$IPKG_INSTROOT/etc/momo/scripts/include.sh"

IPV4_URL="${MOMO_CHINA_IPV4_URL:-https://raw.githubusercontent.com/carrnot/china-ip-list/release/ipv4.txt}"
IPV6_URL="${MOMO_CHINA_IPV6_URL:-https://raw.githubusercontent.com/carrnot/china-ip-list/release/ipv6.txt}"
GEOSITE_URL="${MOMO_GEOSITE_CN_URL:-https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.list}"

fetch() {
	curl -fsSL --connect-timeout 15 --retry 2 -m 120 "$1" -o "$2"
}

write_nft() {
	local src dst set type
	src="$1"
	dst="$2"
	set="$3"
	type="$4"
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
			exit n ? 0 : 1;
		}
	' "$src" > "$dst"
}

write_geosite() {
	local src dst
	src="$1"
	dst="$2"
	sed -e 's/#.*//' -e 's/@.*//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' "$src" | awk '
		/^\+\./ { sub(/^\+\./, ""); print; next }
		/^full:/ { sub(/^full:/, ""); print; next }
		/^[A-Za-z0-9.-]+$/ { print }
	' | sort -u > "$dst"
	[ -s "$dst" ]
}

main() {
	prepare_files
	mkdir -p "$FIREWALL_DIR" "$RULES_DIR" "$TEMP_DIR"

	local ipv4 ipv6 geosite nft4 nft6 domains
	ipv4="$TEMP_DIR/china-ipv4.txt"
	ipv6="$TEMP_DIR/china-ipv6.txt"
	geosite="$TEMP_DIR/geosite-cn.list"
	nft4="$TEMP_DIR/geoip_cn.nft"
	nft6="$TEMP_DIR/geoip6_cn.nft"
	domains="$TEMP_DIR/geosite_cn.txt"

	log "Geo" "Update China IPv4 list."
	fetch "$IPV4_URL" "$ipv4" && write_nft "$ipv4" "$nft4" "china_ip" "ipv4_addr" && mv "$nft4" "$GEOIP_CN_NFT" || return 1

	log "Geo" "Update China IPv6 list."
	fetch "$IPV6_URL" "$ipv6" && write_nft "$ipv6" "$nft6" "china_ip6" "ipv6_addr" && mv "$nft6" "$GEOIP6_CN_NFT" || return 1

	log "Geo" "Update China domain list."
	fetch "$GEOSITE_URL" "$geosite" && write_geosite "$geosite" "$domains" && mv "$domains" "$GEOSITE_CN_TXT" || return 1

	rm -f "$ipv4" "$ipv6" "$geosite" "$nft4" "$nft6" "$domains"
	log "Geo" "China bypass rules updated."
}

main "$@"
