#!/usr/bin/ucode

'use strict';

import { cursor } from 'uci';
import { uci_bool, uci_int, uci_array, merge, trim_all, load_profile, save_profile } from '/etc/momo/ucode/include.uc';

const uci = cursor();

function uci_json_array(obj) {
	if (obj == null || length(obj) == 0) {
		return [];
	}
	try {
		const result = json(obj);
		if (type(result) == 'array') {
			return result;
		}
	} catch (e) {
	}
	return [];
}

const config = {};

config['log'] = {};
config['log']['disabled'] = uci_bool(uci.get('momo', 'mixin', 'log_disabled'));
config['log']['level'] = uci.get('momo', 'mixin', 'log_level');
config['log']['timestamp'] = uci_bool(uci.get('momo', 'mixin', 'log_timestamp'));
config['log']['output'] = uci.get('momo', 'mixin', 'log_output');

config['dns'] = {};
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

const route_rules_prepend = uci_json_array(uci.get('momo', 'mixin', 'route_rules_prepend'));
const route_rules_append = uci_json_array(uci.get('momo', 'mixin', 'route_rules_append'));
if (length(route_rules_prepend) > 0 || length(route_rules_append) > 0) {
	if (profile['route'] == null || type(profile['route']) != 'object') {
		profile['route'] = {};
	}
	if (profile['route']['rules'] == null || type(profile['route']['rules']) != 'array') {
		profile['route']['rules'] = [];
	}
	let rules = [];
	for (let rule in route_rules_prepend) {
		push(rules, rule);
	}
	for (let rule in profile['route']['rules']) {
		push(rules, rule);
	}
	for (let rule in route_rules_append) {
		push(rules, rule);
	}
	profile['route']['rules'] = rules;
}

save_profile(profile);
