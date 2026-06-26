#!/usr/bin/ucode

'use strict';

import { popen, readfile, writefile } from 'fs';

const input_path = ARGV[0];
const output_path = ARGV[1];

function shellquote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
}

function b64decode(value) {
	value = trim('' + (value || ''));
	if (length(value) == 0) {
		return '';
	}

	value = replace(value, /-/g, '+');
	value = replace(value, /_/g, '/');
	while (length(value) % 4 != 0) {
		value += '=';
	}

	const tmp_path = '/tmp/momo-share-b64-' + sprintf('%08x', time()) + '.txt';
	writefile(tmp_path, value);

	const process = popen('openssl base64 -A -d -in ' + shellquote(tmp_path) + ' 2>/dev/null');
	let decoded = '';
	if (process) {
		decoded = process.read('all');
		process.close();
	}
	system('rm -f ' + shellquote(tmp_path));

	return decoded || '';
}

function hex_value(ch) {
	const alphabet = '0123456789ABCDEF';
	const value = index(alphabet, uc(ch || ''));
	return value >= 0 ? value : -1;
}

function url_decode(value) {
	value = replace('' + (value || ''), /\+/g, ' ');

	let result = '';
	for (let i = 0; i < length(value); i++) {
		const ch = substr(value, i, 1);
		if (ch == '%' && i + 2 < length(value)) {
			const hi = hex_value(substr(value, i + 1, 1));
			const lo = hex_value(substr(value, i + 2, 1));
			if (hi >= 0 && lo >= 0) {
				result += chr(hi * 16 + lo);
				i += 2;
				continue;
			}
		}
		result += ch;
	}
	return result;
}

function rindex(value, needle) {
	value = '' + (value || '');
	needle = '' + (needle || '');
	if (length(needle) == 0 || length(value) < length(needle)) {
		return -1;
	}
	for (let i = length(value) - length(needle); i >= 0; i--) {
		if (substr(value, i, length(needle)) == needle) {
			return i;
		}
	}
	return -1;
}

function split_once(value, needle) {
	const pos = index(value, needle);
	if (pos < 0) {
		return [ value, '' ];
	}
	return [ substr(value, 0, pos), substr(value, pos + length(needle)) ];
}

function strip_fragment(value) {
	const parts = split_once(value, '#');
	return {
		value: parts[0],
		fragment: url_decode(parts[1] || '')
	};
}

function parse_query(query) {
	let result = {};
	for (let item in split(query || '', '&')) {
		if (length(item) == 0) {
			continue;
		}
		const pair = split_once(item, '=');
		result[url_decode(pair[0])] = url_decode(pair[1] || '');
	}
	return result;
}

function parse_host_port(authority) {
	authority = '' + (authority || '');
	if (substr(authority, 0, 1) == '[') {
		const end = index(authority, ']');
		if (end >= 0) {
			const host = substr(authority, 1, end - 1);
			let port = substr(authority, end + 1);
			if (substr(port, 0, 1) == ':') {
				port = substr(port, 1);
			}
			return { host: host, port: int(port || 0) };
		}
	}

	const pos = rindex(authority, ':');
	if (pos < 0) {
		return { host: authority, port: 0 };
	}

	return {
		host: substr(authority, 0, pos),
		port: int(substr(authority, pos + 1) || 0)
	};
}

function tag_name(preferred, fallback) {
	preferred = trim(url_decode(preferred || ''));
	return length(preferred) > 0 ? preferred : fallback;
}

function add_tls(outbound, params, enabled) {
	const security = lc(params.security || '');
	if (!enabled && security != 'tls' && security != 'reality') {
		return;
	}

	let tls = {
		enabled: true
	};

	const server_name = params.sni || params.servername || params.peer || params.host || outbound.server;
	if (server_name) {
		tls.server_name = server_name;
	}

	if (params.allowInsecure == '1' || params.allow_insecure == '1' || params.insecure == '1') {
		tls.insecure = true;
	}

	if (security == 'reality') {
		tls.reality = {
			enabled: true
		};
		if (params.pbk || params.public_key || params.publicKey) {
			tls.reality.public_key = params.pbk || params.public_key || params.publicKey;
		}
		if (params.sid || params.short_id || params.shortId) {
			tls.reality.short_id = params.sid || params.short_id || params.shortId;
		}
	}

	const fingerprint = params.fp || params.fingerprint;
	if (fingerprint) {
		tls.utls = {
			enabled: true,
			fingerprint: fingerprint
		};
	}

	outbound.tls = tls;
}

function add_transport(outbound, transport_type, params) {
	transport_type = lc(transport_type || '');
	if (transport_type == '' || transport_type == 'tcp') {
		return;
	}

	if (transport_type == 'ws' || transport_type == 'websocket') {
		let transport = {
			type: 'ws'
		};
		if (params.path) {
			transport.path = params.path;
		}
		const host = params.host || params['ws-opts.headers.Host'];
		if (host) {
			transport.headers = { Host: host };
		}
		outbound.transport = transport;
		return;
	}

	if (transport_type == 'grpc') {
		let transport = {
			type: 'grpc'
		};
		if (params.serviceName || params.service_name) {
			transport.service_name = params.serviceName || params.service_name;
		}
		outbound.transport = transport;
		return;
	}

	if (transport_type == 'http' || transport_type == 'h2') {
		let transport = {
			type: 'http'
		};
		if (params.path) {
			transport.path = params.path;
		}
		if (params.host) {
			transport.host = split(params.host, ',');
		}
		outbound.transport = transport;
	}
}

function parse_ss(uri, fallback) {
	let item = strip_fragment(substr(uri, length('ss://')));
	let main = split_once(item.value, '?')[0];
	let method = '', password = '', authority = '';

	if (index(main, '@') >= 0) {
		const at = rindex(main, '@');
		const userinfo = substr(main, 0, at);
		authority = substr(main, at + 1);
		let decoded = index(userinfo, ':') >= 0 ? url_decode(userinfo) : b64decode(userinfo);
		const parts = split_once(decoded, ':');
		method = parts[0];
		password = parts[1];
	} else {
		const decoded = b64decode(main);
		const at = rindex(decoded, '@');
		if (at < 0) {
			return null;
		}
		const userinfo = substr(decoded, 0, at);
		authority = substr(decoded, at + 1);
		const parts = split_once(userinfo, ':');
		method = parts[0];
		password = parts[1];
	}

	const host_port = parse_host_port(authority);
	if (!method || !password || !host_port.host || !host_port.port) {
		return null;
	}

	return {
		type: 'shadowsocks',
		tag: tag_name(item.fragment, fallback),
		server: host_port.host,
		server_port: host_port.port,
		method: method,
		password: password
	};
}

function parse_vmess(uri, fallback) {
	const payload = strip_fragment(substr(uri, length('vmess://'))).value;
	let source;
	try {
		source = json(b64decode(payload));
	} catch (e) {
		return null;
	}

	let outbound = {
		type: 'vmess',
		tag: tag_name(source.ps, fallback),
		server: source.add,
		server_port: int(source.port || 0),
		uuid: source.id,
		security: source.scy || source.security || 'auto',
		alter_id: int(source.aid || 0)
	};

	if (!outbound.server || !outbound.server_port || !outbound.uuid) {
		return null;
	}

	let params = {
		security: source.tls == 'tls' ? 'tls' : '',
		sni: source.sni || source.host,
		host: source.host,
		path: source.path
	};
	add_tls(outbound, params, source.tls == 'tls');
	add_transport(outbound, source.net, params);

	return outbound;
}

function parse_vless(uri, fallback) {
	let item = strip_fragment(substr(uri, length('vless://')));
	let query_parts = split_once(item.value, '?');
	let params = parse_query(query_parts[1]);
	const at = rindex(query_parts[0], '@');
	if (at < 0) {
		return null;
	}

	const uuid = url_decode(substr(query_parts[0], 0, at));
	const host_port = parse_host_port(substr(query_parts[0], at + 1));
	let outbound = {
		type: 'vless',
		tag: tag_name(item.fragment, fallback),
		server: host_port.host,
		server_port: host_port.port,
		uuid: uuid
	};

	if (!outbound.server || !outbound.server_port || !outbound.uuid) {
		return null;
	}

	if (params.flow) {
		outbound.flow = params.flow;
	}
	if (params.packetEncoding || params.packet_encoding) {
		outbound.packet_encoding = params.packetEncoding || params.packet_encoding;
	}

	add_tls(outbound, params, false);
	add_transport(outbound, params.type || params.network, params);

	return outbound;
}

function parse_trojan(uri, fallback) {
	let item = strip_fragment(substr(uri, length('trojan://')));
	let query_parts = split_once(item.value, '?');
	let params = parse_query(query_parts[1]);
	const at = rindex(query_parts[0], '@');
	if (at < 0) {
		return null;
	}

	const password = url_decode(substr(query_parts[0], 0, at));
	const host_port = parse_host_port(substr(query_parts[0], at + 1));
	let outbound = {
		type: 'trojan',
		tag: tag_name(item.fragment, fallback),
		server: host_port.host,
		server_port: host_port.port,
		password: password
	};

	if (!outbound.server || !outbound.server_port || !outbound.password) {
		return null;
	}

	add_tls(outbound, params, lc(params.security || 'tls') != 'none');
	add_transport(outbound, params.type || params.network, params);

	return outbound;
}

function decode_subscription(raw) {
	let text = replace(raw || '', /\r/g, '\n');
	if (match(text, /(vmess|vless|trojan|ss):\/\//)) {
		return text;
	}

	const compact = replace(text, /[\s|]+/g, '');
	const decoded = b64decode(compact);
	if (match(decoded, /(vmess|vless|trojan|ss):\/\//)) {
		return replace(decoded, /\r/g, '\n');
	}

	return text;
}

function add_node(nodes, seen, node) {
	if (node == null || type(node) != 'object') {
		return;
	}

	let tag = trim('' + (node.tag || ''));
	if (length(tag) == 0) {
		tag = 'node-' + (length(nodes) + 1);
	}

	const base = tag;
	let index = 2;
	while (seen[tag]) {
		tag = base + '-' + index;
		index++;
	}

	node.tag = tag;
	seen[tag] = true;
	push(nodes, node);
}

function parse_nodes(raw) {
	const text = decode_subscription(raw);
	const candidates = split(replace(text, /[|\n\t ]+/g, '\n'), '\n');
	let nodes = [];
	let seen = {};
	let index = 1;

	for (let candidate in candidates) {
		candidate = trim(candidate || '');
		if (length(candidate) == 0) {
			continue;
		}

		let node = null;
		const fallback = 'node-' + index;
		if (substr(candidate, 0, length('vmess://')) == 'vmess://') {
			node = parse_vmess(candidate, fallback);
		} else if (substr(candidate, 0, length('vless://')) == 'vless://') {
			node = parse_vless(candidate, fallback);
		} else if (substr(candidate, 0, length('trojan://')) == 'trojan://') {
			node = parse_trojan(candidate, fallback);
		} else if (substr(candidate, 0, length('ss://')) == 'ss://') {
			node = parse_ss(candidate, fallback);
		}

		if (node) {
			add_node(nodes, seen, node);
			index++;
		}
	}

	return nodes;
}

function build_profile(nodes) {
	let node_tags = [];
	for (let node in nodes) {
		push(node_tags, node.tag);
	}

	let selector = [ 'direct' ];
	for (let tag in node_tags) {
		push(selector, tag);
	}

	let outbounds = [
		{ type: 'direct', tag: 'direct' },
		{ type: 'block', tag: 'block' }
	];
	for (let node in nodes) {
		push(outbounds, node);
	}
	push(outbounds, {
		type: 'selector',
		tag: 'proxy',
		outbounds: selector
	});

	return {
		log: {
			level: 'info',
			timestamp: true
		},
		dns: {
			servers: [
				{
					type: 'udp',
					tag: 'dns-direct',
					server: '223.5.5.5'
				}
			],
			final: 'dns-direct'
		},
		inbounds: [],
		outbounds: outbounds,
		route: {
			rules: [],
			final: length(nodes) > 0 ? 'proxy' : 'direct'
		}
	};
}

function is_node_outbound(outbound) {
	return outbound != null &&
		type(outbound) == 'object' &&
		outbound.type != 'direct' &&
		outbound.type != 'block' &&
		outbound.type != 'dns' &&
		outbound.type != 'selector' &&
		outbound.type != 'urltest';
}

function node_key(outbound) {
	if (!is_node_outbound(outbound)) {
		return '';
	}

	let identity = outbound.uuid || outbound.password || outbound.method || outbound.tag || '';
	return join('|', [
		outbound.type || '',
		outbound.server || '',
		outbound.server_port || '',
		identity
	]);
}

function unique_profile_tag(base, tags) {
	base = trim(base || 'node');
	if (length(base) == 0) {
		base = 'node';
	}

	let tag = base;
	let index = 2;
	while (tags[tag]) {
		tag = base + '-' + index;
		index++;
	}
	tags[tag] = true;
	return tag;
}

function append_nodes_to_groups(profile, new_tags) {
	if (length(new_tags) == 0) {
		return;
	}

	let node_tags = {};
	for (let outbound in profile.outbounds || []) {
		if (is_node_outbound(outbound) && outbound.tag != null && length(outbound.tag) > 0) {
			node_tags[outbound.tag] = true;
		}
	}

	for (let outbound in profile.outbounds || []) {
		if (outbound == null || type(outbound) != 'object') {
			continue;
		}
		if (outbound.type != 'selector' && outbound.type != 'urltest') {
			continue;
		}
		if (type(outbound.outbounds) != 'array') {
			outbound.outbounds = [];
		}

		let seen = {};
		let has_node_ref = false;
		for (let ref in outbound.outbounds) {
			if (ref == null || length(ref) == 0) {
				continue;
			}
			seen[ref] = true;
			if (node_tags[ref]) {
				has_node_ref = true;
			}
		}

		if (!has_node_ref && outbound.type != 'urltest' && outbound.tag != 'proxy' && outbound.tag != 'Proxies') {
			continue;
		}

		for (let tag in new_tags) {
			if (!seen[tag]) {
				push(outbound.outbounds, tag);
				seen[tag] = true;
			}
		}
	}
}

function merge_profile_nodes(input_path, output_path) {
	let nodes = parse_nodes(readfile(input_path) || '');
	if (length(nodes) == 0) {
		warn('No supported share links were found\n');
		exit(1);
	}

	let profile;
	try {
		profile = json(readfile(output_path) || '{}');
	} catch (e) {
		warn('failed to parse target profile: ' + e + '\n');
		exit(1);
	}

	if (profile == null || type(profile) != 'object') {
		profile = {};
	}
	if (type(profile.outbounds) != 'array') {
		profile.outbounds = [];
	}

	let keys = {};
	let tags = {};
	for (let outbound in profile.outbounds) {
		if (outbound?.tag != null && length(outbound.tag) > 0) {
			tags[outbound.tag] = true;
		}

		const key = node_key(outbound);
		if (length(key) > 0) {
			keys[key] = true;
		}
	}

	let new_tags = [];
	let merged = 0;
	for (let node in nodes) {
		const key = node_key(node);
		if (length(key) == 0 || keys[key]) {
			continue;
		}

		node.tag = unique_profile_tag(node.tag, tags);
		keys[key] = true;
		push(profile.outbounds, node);
		push(new_tags, node.tag);
		merged++;
	}

	append_nodes_to_groups(profile, new_tags);
	writefile(output_path, sprintf('%J\n', profile));
	print('Merged ' + merged + ' share-link node(s).\n');
}

if (!input_path || !output_path) {
	warn('usage: share_links_to_singbox.uc <input> <output>\n');
	exit(1);
}

if (ARGV[2] == 'merge') {
	merge_profile_nodes(input_path, output_path);
	exit(0);
}

let nodes = parse_nodes(readfile(input_path) || '');
if (length(nodes) == 0) {
	warn('No supported share links were found\n');
	exit(1);
}

writefile(output_path, sprintf('%J\n', build_profile(nodes)));
