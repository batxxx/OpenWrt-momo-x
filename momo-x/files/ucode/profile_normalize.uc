#!/usr/bin/ucode

'use strict';

import { readfile, writefile } from 'fs';
import { cursor } from 'uci';

const uci = cursor();
const profile_path = ARGV[0];

function option(section, name, fallback) {
	const value = uci.get('momo', section, name);
	return value ?? fallback;
}

function has_tag(items, tag) {
	if (type(items) != 'array') {
		return false;
	}
	for (let item in items) {
		if (item?.tag == tag) {
			return true;
		}
	}
	return false;
}

function unique_tag(base, used) {
	let tag = base;
	let index = 2;
	while (used[tag]) {
		tag = base + '-' + index;
		index++;
	}
	used[tag] = true;
	return tag;
}

function normalize_outbound_compat(outbound) {
	if (outbound == null || type(outbound) != 'object') {
		return true;
	}
	if (outbound.type == 'dns') {
		return false;
	}

	if (outbound.sni != null) {
		if (outbound.tls == null || type(outbound.tls) != 'object') {
			outbound.tls = {};
		}
		if (outbound.tls.server_name == null) {
			outbound.tls.server_name = outbound.sni;
		}
		delete outbound.sni;
	}

	if (outbound.tls != null && type(outbound.tls) == 'object' && outbound.tls.utls != null && type(outbound.tls.utls) == 'object') {
		if (outbound.tls.utls.enable != null && outbound.tls.utls.enabled == null) {
			outbound.tls.utls.enabled = outbound.tls.utls.enable;
		}
		delete outbound.tls.utls.enable;
	}

	return true;
}

function normalize_inbound_compat(inbound) {
	if (inbound == null || type(inbound) != 'object') {
		return;
	}

	if (inbound.type == 'tun') {
		let addresses = [];
		if (inbound.inet4_address != null) {
			push(addresses, inbound.inet4_address);
		}
		if (inbound.inet6_address != null) {
			push(addresses, inbound.inet6_address);
		}
		if (length(addresses) > 0 && inbound.address == null) {
			inbound.address = addresses;
		}
		delete inbound.inet4_address;
		delete inbound.inet6_address;
	}
}

function needs_dns_reset(dns) {
	if (dns == null || type(dns) != 'object') {
		return false;
	}
	if (dns.fakeip != null || dns.rules != null) {
		return true;
	}
	for (let server in dns.servers || []) {
		if (server?.address_resolver != null) {
			return true;
		}
	}
	return false;
}

function normalize_route_rule(rule) {
	if (rule == null || type(rule) != 'object') {
		return false;
	}
	if (rule.geoip != null || rule.geosite != null) {
		return false;
	}
	if (rule.outbound == 'dns-out') {
		delete rule.outbound;
		rule.action = 'hijack-dns';
	}
	return true;
}

function ensure_node_tags(profile) {
	let used = {};
	let node_tags = [];
	let index = 1;
	let outbounds = [];

	if (type(profile.outbounds) != 'array') {
		profile.outbounds = [];
	}

	for (let outbound in profile.outbounds) {
		if (outbound == null || type(outbound) != 'object') {
			continue;
		}
		if (!normalize_outbound_compat(outbound)) {
			continue;
		}

		if (outbound.tag == null || length(outbound.tag) == 0) {
			outbound.tag = 'node-' + index;
		}
		outbound.tag = unique_tag(outbound.tag, used);
		index++;

		if (outbound.type != 'direct' && outbound.type != 'block' && outbound.type != 'dns' && outbound.type != 'selector' && outbound.type != 'urltest') {
			push(node_tags, outbound.tag);
		}
		push(outbounds, outbound);
	}

	profile.outbounds = outbounds;
	return node_tags;
}

function ensure_outbounds(profile, node_tags) {
	if (!has_tag(profile.outbounds, 'direct')) {
		push(profile.outbounds, {
			type: 'direct',
			tag: 'direct'
		});
	}

	if (!has_tag(profile.outbounds, 'block')) {
		push(profile.outbounds, {
			type: 'block',
			tag: 'block'
		});
	}

	if (!has_tag(profile.outbounds, 'proxy') && length(node_tags) > 0) {
		unshift(profile.outbounds, {
			type: 'urltest',
			tag: 'proxy',
			outbounds: node_tags,
			url: 'https://www.gstatic.com/generate_204',
			interval: '10m',
			tolerance: 50
		});
	}
}

function node_tag_lookup(node_tags) {
	let lookup = {};
	if (type(node_tags) != 'array') {
		return lookup;
	}
	for (let tag in node_tags) {
		if (tag != null && length(tag) > 0) {
			lookup[tag] = true;
		}
	}
	return lookup;
}

function has_proxy_node_ref(refs, node_lookup) {
	for (let tag in refs || []) {
		if (node_lookup[tag]) {
			return true;
		}
	}
	return false;
}

function normalize_group_outbounds(profile, node_tags) {
	let tags = {};
	let nodes = node_tag_lookup(node_tags);
	for (let outbound in profile.outbounds || []) {
		if (outbound?.tag != null && length(outbound.tag) > 0) {
			tags[outbound.tag] = true;
		}
	}

	for (let outbound in profile.outbounds || []) {
		if (type(outbound?.outbounds) != 'array') {
			continue;
		}

		let refs = [];
		let seen = {};
		for (let tag in outbound.outbounds) {
			if (tag == null || length(tag) == 0 || !tags[tag] || seen[tag]) {
				continue;
			}
			push(refs, tag);
			seen[tag] = true;
		}

		if ((outbound?.type == 'selector' || outbound?.type == 'urltest') && !has_proxy_node_ref(refs, nodes)) {
			for (let node in node_tags || []) {
				if (node == null || length(node) == 0 || node == outbound?.tag || !tags[node] || seen[node]) {
					continue;
				}
				push(refs, node);
				seen[node] = true;
			}
		}

		if (length(refs) == 0 && tags['direct']) {
			push(refs, 'direct');
		}
		outbound.outbounds = refs;
	}
}

function ensure_inbounds(profile) {
	const dns_inbound_tag = option('core', 'dns_inbound_tag', 'dns-in');
	const redirect_inbound_tag = option('core', 'redirect_inbound_tag', 'redirect-in');
	const tproxy_inbound_tag = option('core', 'tproxy_inbound_tag', 'tproxy-in');
	const tun_inbound_tag = option('core', 'tun_inbound_tag', 'tun-in');

	if (type(profile.inbounds) != 'array') {
		profile.inbounds = [];
	}

	if (!has_tag(profile.inbounds, dns_inbound_tag)) {
		push(profile.inbounds, {
			type: 'direct',
			tag: dns_inbound_tag,
			listen: '::',
			listen_port: 6450
		});
	}

	if (!has_tag(profile.inbounds, redirect_inbound_tag)) {
		push(profile.inbounds, {
			type: 'redirect',
			tag: redirect_inbound_tag,
			listen: '::',
			listen_port: 6451,
			sniff: true
		});
	}

	if (!has_tag(profile.inbounds, tproxy_inbound_tag)) {
		push(profile.inbounds, {
			type: 'tproxy',
			tag: tproxy_inbound_tag,
			listen: '::',
			listen_port: 6452,
			sniff: true
		});
	}

	if (!has_tag(profile.inbounds, tun_inbound_tag)) {
		push(profile.inbounds, {
			type: 'tun',
			tag: tun_inbound_tag,
			interface_name: 'momo-tun',
			address: [
				'172.19.0.1/30',
				'fdfe:dcba:9876::1/126'
			],
			mtu: 9000,
			auto_route: false,
			stack: 'mixed',
			sniff: true
		});
	}

	for (let inbound in profile.inbounds) {
		if (inbound?.tag != tun_inbound_tag || inbound?.type != 'tun') {
			continue;
		}
		if (inbound.interface_name == null || length(inbound.interface_name) == 0) {
			inbound.interface_name = 'momo-tun';
		}
		if (inbound.mtu == null) {
			inbound.mtu = 9000;
		}
		if (inbound.stack == null) {
			inbound.stack = 'mixed';
		}
	}
}

function ensure_dns(profile) {
	if (profile.dns == null || type(profile.dns) != 'object') {
		profile.dns = {};
	}
	if (type(profile.dns.servers) != 'array' || length(profile.dns.servers) == 0) {
		profile.dns.servers = [];
	}

	let has_direct_dns = false;
	for (let server in profile.dns.servers) {
		if (server?.tag == 'dns-direct') {
			server.type = 'udp';
			if (server.server == null || length(server.server) == 0) {
				server.server = server.address ?? '223.5.5.5';
			}
			delete server.address;
			delete server.detour;
			has_direct_dns = true;
		}
	}

	if (!has_direct_dns) {
		push(profile.dns.servers, {
			type: 'udp',
			tag: 'dns-direct',
			server: '223.5.5.5'
		});
	}

	profile.dns.final = 'dns-direct';
	if (profile.dns.independent_cache == null) {
		profile.dns.independent_cache = true;
	}
}

function ensure_route(profile, node_tags) {
	const dns_inbound_tag = option('core', 'dns_inbound_tag', 'dns-in');

	if (profile.route == null || type(profile.route) != 'object') {
		profile.route = {};
	}
	if (type(profile.route.rules) != 'array') {
		profile.route.rules = [];
	}

	let has_dns_hijack = false;
	let rules = [];
	for (let rule in profile.route.rules) {
		if (!normalize_route_rule(rule)) {
			continue;
		}
		if (rule?.inbound == dns_inbound_tag && rule?.action == 'hijack-dns') {
			has_dns_hijack = true;
		}
		push(rules, rule);
	}
	profile.route.rules = rules;
	if (!has_dns_hijack) {
		unshift(profile.route.rules, {
			inbound: dns_inbound_tag,
			action: 'hijack-dns'
		});
	}

	if (profile.route.final == null) {
		profile.route.final = length(node_tags) > 0 ? 'proxy' : 'direct';
	}
	if (profile.route.auto_detect_interface == null) {
		profile.route.auto_detect_interface = true;
	}
}

if (profile_path == null || length(profile_path) == 0) {
	warn('profile path is required\n');
	exit(1);
}

let profile;
try {
	profile = json(readfile(profile_path));
} catch (e) {
	warn('failed to parse profile: ' + e + '\n');
	exit(1);
}

const node_tags = ensure_node_tags(profile);
ensure_outbounds(profile, node_tags);
normalize_group_outbounds(profile, node_tags);
for (let inbound in profile.inbounds || []) {
	normalize_inbound_compat(inbound);
}
ensure_inbounds(profile);
if (needs_dns_reset(profile.dns)) {
	profile.dns = {};
}
ensure_dns(profile);
ensure_route(profile, node_tags);

writefile(profile_path, profile);
