#!/usr/bin/ucode

'use strict';

import { cursor } from 'uci';
import { popen } from 'fs';
import { uci_bool, uci_int, uci_array, merge, trim_all, load_profile, save_profile } from '/etc/momo/ucode/include.uc';

const uci = cursor();

function shellquote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
}

function dns_tag(index) {
	return index == 0 ? 'dns-direct' : 'dns-direct-' + (index + 1);
}

function dns_available(server) {
	if (!match(server, /^[A-Za-z0-9_.:-]+$/)) {
		return true;
	}
	const process = popen('nslookup -timeout=1 -retry=1 www.qq.com ' + shellquote(server) + ' >/dev/null 2>&1; echo $?');
	if (!process) {
		return false;
	}
	const result = trim(process.read('all'));
	process.close();
	return result == '0';
}

function dns_servers_config(values) {
	let servers = [];
	let final = null;
	for (let value in values) {
		const server = trim('' + value);
		if (length(server) == 0) {
			continue;
		}
		const tag = dns_tag(length(servers));
		push(servers, {
			type: 'udp',
			tag,
			server
		});
		if (final == null && dns_available(server)) {
			final = tag;
		}
	}
	if (length(servers) == 0) {
		push(servers, {
			type: 'udp',
			tag: 'dns-direct',
			server: '119.29.29.29'
		});
		final = 'dns-direct';
	}
	return {
		servers,
		final: final ?? servers[0].tag
	};
}

const config = {};

config['log'] = {};
config['log']['disabled'] = uci_bool(uci.get('momo', 'mixin', 'log_disabled'));
config['log']['level'] = uci.get('momo', 'mixin', 'log_level');
config['log']['timestamp'] = uci_bool(uci.get('momo', 'mixin', 'log_timestamp'));
config['log']['output'] = uci.get('momo', 'mixin', 'log_output');

config['dns'] = {};
const dns_config = dns_servers_config(uci_array(uci.get('momo', 'mixin', 'dns_server')));
if (length(dns_config.servers) > 0) {
	config['dns']['servers'] = dns_config.servers;
	config['dns']['final'] = dns_config.final;
}
if (uci_bool(uci.get('momo', 'mixin', 'dns_fakeip'))) {
	const fake_ip_dns_server_tag = uci.get('momo', 'core', 'fake_ip_dns_server_tag') || 'fake-ip-dns-server';
	push(config['dns']['servers'], {
		type: 'fakeip',
		tag: fake_ip_dns_server_tag,
		inet4_range: '198.18.0.0/15',
		inet6_range: 'fc00::/18'
	});
	config['dns']['rules'] = [
		// Reject PTR/reverse lookups (incl. private in-addr.arpa and mDNS _dns-sd._udp)
		// so they don't leak to the upstream resolver, hang ~80s, and clog DNS.
		{
			query_type: [
				'PTR'
			],
			action: 'predefined',
			rcode: 'NXDOMAIN'
		},
		{
			query_type: [
				'A',
				'AAAA'
			],
			server: fake_ip_dns_server_tag
		}
	];
}
config['dns']['strategy'] = uci.get('momo', 'mixin', 'dns_strategy');
config['dns']['disable_cache'] = uci_bool(uci.get('momo', 'mixin', 'dns_disable_cache'));
config['dns']['disable_expire'] = uci_bool(uci.get('momo', 'mixin', 'dns_disable_expire'));
config['dns']['independent_cache'] = uci_bool(uci.get('momo', 'mixin', 'dns_independent_cache'));
config['dns']['cache_capacity'] = uci_int(uci.get('momo', 'mixin', 'dns_cache_capacity'));
config['dns']['reverse_mapping'] = uci_bool(uci.get('momo', 'mixin', 'dns_reverse_mapping'));

config['ntp'] = {};
config['ntp']['enabled'] = uci_bool(uci.get('momo', 'mixin', 'ntp_enabled'));
config['ntp']['server'] = uci.get('momo', 'mixin', 'ntp_server');
config['ntp']['server_port'] = uci_int(uci.get('momo', 'mixin', 'ntp_server_port'));
config['ntp']['interval'] = uci.get('momo', 'mixin', 'ntp_interval');

config['experimental'] = {};

config['experimental']['cache_file'] = {};
config['experimental']['cache_file']['enabled'] = uci_bool(uci.get('momo', 'mixin', 'cache_enabled'));
config['experimental']['cache_file']['path'] = uci.get('momo', 'mixin', 'cache_path');
config['experimental']['cache_file']['store_fakeip'] = uci_bool(uci.get('momo', 'mixin', 'cache_store_fakeip'));
config['experimental']['cache_file']['store_rdrc'] = uci_bool(uci.get('momo', 'mixin', 'cache_store_rdrc'));

config['experimental']['clash_api'] = {};
config['experimental']['clash_api']['external_ui'] = uci.get('momo', 'mixin', 'external_control_ui_path');
config['experimental']['clash_api']['external_ui_download_url'] = uci.get('momo', 'mixin', 'external_control_ui_download_url');
config['experimental']['clash_api']['external_ui_download_detour'] = uci.get('momo', 'mixin', 'external_control_ui_download_detour');
config['experimental']['clash_api']['external_controller'] = uci.get('momo', 'mixin', 'external_control_api_listen');
config['experimental']['clash_api']['secret'] = uci.get('momo', 'mixin', 'external_control_api_secret');

const profile = load_profile();

merge(profile, trim_all(config));

save_profile(profile);
