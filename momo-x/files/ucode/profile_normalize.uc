#!/usr/bin/ucode

'use strict';

import { access, readfile, writefile } from 'fs';
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
	if (outbound.plugin != null || outbound.plugin_opts != null) {
		// ponytail: sing-box package here has no external SIP003 plugins; drop those nodes instead of failing the whole profile.
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
	let server_tags = {};
	let servers = [];
	for (let server in profile.dns.servers) {
		if (server == null || type(server) != 'object') {
			continue;
		}

		if (server.address_resolver != null && server.domain_resolver == null) {
			server.domain_resolver = server.address_resolver;
		}
		delete server.address_resolver;

		if (server?.tag == 'dns_direct') {
			server.tag = 'dns-direct';
		}
		if (server?.tag == 'dns-direct') {
			server.type = 'udp';
			if (server.server == null || length(server.server) == 0) {
				server.server = server.address ?? '119.29.29.29';
			}
			if (index(server.server, '://') >= 0 || server.server == 'fakeip') {
				server.server = '119.29.29.29';
			}
			delete server.address;
			delete server.detour;
			delete server.domain_resolver;
			has_direct_dns = true;
		}

		// Drop legacy sing-box DNS servers such as {"address": "tls://..."}.
		// sing-box 1.12 can reject mixed legacy/new resolver references.
		if (server.address != null || server.type == null) {
			continue;
		}
		if (server.tag == null || length(server.tag) == 0) {
			continue;
		}
		server_tags[server.tag] = true;
		push(servers, server);
	}

	if (!has_direct_dns) {
		server_tags['dns-direct'] = true;
		push(servers, {
			type: 'udp',
			tag: 'dns-direct',
			server: '119.29.29.29'
		});
	}

	let rules = [];
	for (let rule in profile.dns.rules || []) {
		if (rule == null || type(rule) != 'object') {
			continue;
		}
		if (rule.geoip != null || rule.geosite != null) {
			continue;
		}
		if (rule.server != null && !server_tags[rule.server]) {
			continue;
		}
		push(rules, rule);
	}

	profile.dns.servers = servers;
	profile.dns.rules = rules;
	profile.dns.final = 'dns-direct';
	delete profile.dns.fakeip;
	if (profile.dns.independent_cache == null) {
		profile.dns.independent_cache = true;
	}
}

function clean_domain(value) {
	let domain = lc(trim('' + value));
	if (length(domain) == 0) {
		return null;
	}
	if (substr(domain, 0, 2) == '*.') {
		domain = substr(domain, 2);
	}
	if (match(domain, /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/) && index(domain, '..') < 0) {
		return domain;
	}
	return null;
}

function direct_domains() {
	let domains = [];
	let seen = {};
	const geosite_cn = '/etc/momo/rules/geosite_cn.txt';
	for (let value in uci.get('momo', 'proxy', 'bypass_domain') || []) {
		const domain = clean_domain(value);
		if (domain != null && !seen[domain]) {
			push(domains, domain);
			seen[domain] = true;
		}
	}
	if (uci.get('momo', 'proxy', 'bypass_china_mainland_domain') == '1' && access(geosite_cn)) {
		for (let value in split(readfile(geosite_cn), '\n')) {
			const domain = clean_domain(value);
			if (domain != null && !seen[domain]) {
				push(domains, domain);
				seen[domain] = true;
			}
		}
	}
	return domains;
}

function is_generated_china_domain_rule(rule) {
	if (rule?.outbound != 'direct' || type(rule?.domain_suffix) != 'array' || length(rule.domain_suffix) < 1000) {
		return false;
	}
	for (let domain in rule.domain_suffix) {
		if (domain == 'xiaohongshu.com') {
			return true;
		}
	}
	return false;
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
		if (is_generated_china_domain_rule(rule)) {
			continue;
		}
		if (rule?.inbound == dns_inbound_tag && rule?.action == 'hijack-dns') {
			has_dns_hijack = true;
		}
		push(rules, rule);
	}
	profile.route.rules = rules;
	const bypass_domain = direct_domains();
	if (length(bypass_domain) > 0) {
		unshift(profile.route.rules, {
			domain_suffix: bypass_domain,
			outbound: 'direct'
		});
	}
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
ensure_dns(profile);
ensure_route(profile, node_tags);

writefile(profile_path, profile);
