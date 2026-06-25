#!/usr/bin/ucode

'use strict';

import { readfile, writefile } from 'fs';
import { cursor } from 'uci';

const uci = cursor();
const profile_path = ARGV[0];
const managed_selector_tag = '所有节点';
const managed_urltest_tag = '所有节点 自动选择';
const legacy_managed_selector_tag = '规则附加';
const legacy_managed_urltest_tag = '规则附加 自动选择';

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

const rule_fields = [
	'domain',
	'domain_suffix',
	'domain_keyword',
	'domain_regex',
	'ip_cidr',
	'rule_set',
	'process_name',
	'package_name',
	'protocol',
	'port'
];

function is_system_outbound_type(name) {
	return name == 'selector' || name == 'urltest' || name == 'direct' || name == 'block' || name == 'dns';
}

function is_rule_field(name) {
	for (let field in rule_fields) {
		if (field == name) {
			return true;
		}
	}
	return false;
}

function unique_values(value) {
	let source = type(value) == 'array' ? value : [ value ];
	let seen = {};
	let result = [];

	for (let item in source) {
		if (item == null) {
			continue;
		}
		item = trim('' + item);
		if (length(item) == 0 || seen[item]) {
			continue;
		}
		seen[item] = true;
		push(result, item);
	}

	return result;
}

function normalize_rule_for_key(rule) {
	let normalized = {};

	if (rule == null || type(rule) != 'object') {
		return normalized;
	}

	if (rule['outbound'] != null && length(trim('' + rule['outbound'])) > 0) {
		let outbound = trim('' + rule['outbound']);
		normalized['outbound'] = outbound == legacy_managed_selector_tag ? managed_selector_tag : outbound;
	}
	if (rule['action'] != null && length(trim('' + rule['action'])) > 0) {
		normalized['action'] = trim('' + rule['action']);
	}

	for (let field in rule_fields) {
		if (rule[field] == null) {
			continue;
		}
		let values = unique_values(rule[field]);
		if (length(values) > 0) {
			normalized[field] = values;
		}
	}

	for (let key in keys(rule)) {
		if (key == 'outbound' || key == 'action' || is_rule_field(key)) {
			continue;
		}
		normalized[key] = rule[key];
	}

	return normalized;
}

function rule_key(rule) {
	return sprintf('%J', normalize_rule_for_key(rule));
}

function profile_outbound_tags(profile) {
	let tags = {
		'DIRECT': true,
		'REJECT': true
	};
	tags[managed_selector_tag] = true;
	tags[managed_urltest_tag] = true;
	tags[legacy_managed_selector_tag] = true;
	tags[legacy_managed_urltest_tag] = true;

	if (type(profile?.outbounds) != 'array') {
		return tags;
	}

	for (let outbound in profile.outbounds) {
		if (outbound?.tag != null && length(trim('' + outbound.tag)) > 0) {
			tags[trim('' + outbound.tag)] = true;
		}
	}

	return tags;
}

function proxy_node_tags(profile) {
	let seen = {};
	let result = [];

	if (type(profile?.outbounds) != 'array') {
		return result;
	}

	for (let outbound in profile.outbounds) {
		let tag = trim('' + (outbound?.tag || ''));
		let outbound_type = trim('' + (outbound?.type || ''));
		if (length(tag) == 0 || tag == managed_selector_tag || tag == managed_urltest_tag ||
		    tag == legacy_managed_selector_tag || tag == legacy_managed_urltest_tag ||
		    is_system_outbound_type(outbound_type) || seen[tag]) {
			continue;
		}
		seen[tag] = true;
		push(result, tag);
	}

	return result;
}

function upsert_outbound(profile, outbound) {
	if (type(profile.outbounds) != 'array') {
		profile.outbounds = [];
	}

	let tag = outbound?.tag;
	if (tag == null || length(tag) == 0) {
		return;
	}

	for (let i = 0; i < length(profile.outbounds); i++) {
		if (profile.outbounds[i]?.tag == tag) {
			profile.outbounds[i] = outbound;
			return;
		}
	}

	push(profile.outbounds, outbound);
}

function remove_legacy_managed_outbounds(profile) {
	if (type(profile.outbounds) != 'array') {
		profile.outbounds = [];
		return;
	}

	let outbounds = [];
	for (let outbound in profile.outbounds) {
		let tag = trim('' + (outbound?.tag || ''));
		if (tag == legacy_managed_selector_tag || tag == legacy_managed_urltest_tag) {
			continue;
		}
		push(outbounds, outbound);
	}
	profile.outbounds = outbounds;
}

function ensure_managed_outbounds(profile) {
	if (type(profile.outbounds) != 'array') {
		profile.outbounds = [];
	}

	remove_legacy_managed_outbounds(profile);
	let nodes = proxy_node_tags(profile);

	if (length(nodes) > 0) {
		upsert_outbound(profile, {
			type: 'urltest',
			tag: managed_urltest_tag,
			outbounds: nodes,
			url: 'https://www.gstatic.com/generate_204',
			interval: '10m',
			tolerance: 50
		});
	}

	let selector_outbounds = [];
	if (length(nodes) > 0) {
		push(selector_outbounds, managed_urltest_tag);
	}
	push(selector_outbounds, 'DIRECT');
	for (let node in nodes) {
		push(selector_outbounds, node);
	}

	upsert_outbound(profile, {
		type: 'selector',
		tag: managed_selector_tag,
		outbounds: selector_outbounds
	});
}

function validate_rule_targets(profile, rules) {
	let tags = profile_outbound_tags(profile);
	let missing = [];
	let seen = {};

	for (let rule in rules) {
		let outbound = rule?.outbound;
		if (outbound == null || length(trim('' + outbound)) == 0) {
			continue;
		}
		outbound = trim('' + outbound);
		if (outbound == legacy_managed_selector_tag) {
			rule.outbound = managed_selector_tag;
			outbound = managed_selector_tag;
		}
		if (!tags[outbound] && !seen[outbound]) {
			seen[outbound] = true;
			push(missing, outbound);
		}
	}

	if (length(missing) > 0) {
		warn('unknown route append outbound: ' + join(', ', missing) + '\n');
		return false;
	}

	return true;
}

function apply_route_rules(profile) {
	const route_rules_prepend = uci_json_array(uci.get('momo', 'mixin', 'route_rules_prepend'));
	const route_rules_append = uci_json_array(uci.get('momo', 'mixin', 'route_rules_append'));
	if (length(route_rules_prepend) == 0 && length(route_rules_append) == 0) {
		return profile;
	}
	ensure_managed_outbounds(profile);
	if (!validate_rule_targets(profile, route_rules_prepend) || !validate_rule_targets(profile, route_rules_append)) {
		exit(1);
	}
	if (profile['route'] == null || type(profile['route']) != 'object') {
		profile['route'] = {};
	}
	if (profile['route']['rules'] == null || type(profile['route']['rules']) != 'array') {
		profile['route']['rules'] = [];
	}
	let rules = [];
	let seen = {};
	function push_rule(rule) {
		const key = rule_key(rule);
		if (seen[key]) {
			return;
		}
		seen[key] = true;
		push(rules, rule);
	}
	for (let rule in route_rules_prepend) {
		push_rule(rule);
	}
	for (let rule in profile['route']['rules']) {
		push_rule(rule);
	}
	for (let rule in route_rules_append) {
		push_rule(rule);
	}
	profile['route']['rules'] = rules;
	return profile;
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

writefile(profile_path, apply_route_rules(profile));
