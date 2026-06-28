'use strict';
'require form';
'require view';
'require uci';
'require network';
'require tools.momo as momo';

function normalizeButtons(node) {
    node.querySelectorAll('button').forEach(function (button) {
        button.setAttribute('type', 'button');
    });
    return node;
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('momo'),
            network.getHostHints(),
            network.getNetworks(),
            momo.getIdentifiers(),
        ]);
    },
    render: function (data) {
        const hosts = data[1].hosts;
        const networks = data[2];
        const users = data[3]?.users ?? [];
        const groups = data[3]?.groups ?? [];
        const cgroups = data[3]?.cgroups ?? [];

        let m, s, o, so;

        m = new form.Map('momo');

        s = m.section(form.NamedSection, 'proxy', 'proxy', _('代理配置'));
        s.description = _('这里控制透明代理、防火墙劫持、路由器自身代理和局域网设备代理。修改后需要保存并应用或重启服务才会生效。');

        s.tab('proxy', _('透明代理'));

        o = s.taboption('proxy', form.Flag, 'enabled', _('启用代理'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'ipv4_dns_hijack', _('劫持 IPv4 DNS'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'ipv6_dns_hijack', _('劫持 IPv6 DNS'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'ipv4_proxy', _('代理 IPv4 流量'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'ipv6_proxy', _('代理 IPv6 流量'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'fake_ip_ping_hijack', _('劫持 Fake-IP Ping'));
        o.rmempty = false;

        o = s.taboption('proxy', form.ListValue, 'tcp_mode', _('TCP 代理模式'));
        o.optional = true;
        o.placeholder = _('禁用');
        o.value('redirect', _('Redirect 模式'));
        o.value('tproxy', _('TPROXY 模式'));
        o.value('tun', _('TUN 模式'));

        o = s.taboption('proxy', form.ListValue, 'udp_mode', _('UDP 代理模式'));
        o.optional = true;
        o.placeholder = _('禁用');
        o.value('tproxy', _('TPROXY 模式'));
        o.value('tun', _('TUN 模式'));

        s.tab('router', _('路由器自身代理'));

        o = s.taboption('router', form.Flag, 'router_proxy', _('启用'));
        o.rmempty = false;

        o = s.taboption('router', form.SectionValue, '_router_access_control', form.TableSection, 'router_access_control', _('访问控制'));
        o.retain = true;
        o.depends('router_proxy', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('启用'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'user', _('用户'));

        for (const user of users) {
            so.value(user);
        };

        so = o.subsection.option(form.DynamicList, 'group', _('用户组'));

        for (const group of groups) {
            so.value(group);
        };

        so = o.subsection.option(form.DynamicList, 'cgroup', _('CGroup'));

        for (const cgroup of cgroups) {
            so.value(cgroup);
        };

        so = o.subsection.option(form.Flag, 'dns', _('DNS'));
        so.rmempty = false;

        so = o.subsection.option(form.Flag, 'proxy', _('代理'));
        so.rmempty = false;

        s.tab('lan', _('局域网代理'));

        o = s.taboption('lan', form.Flag, 'lan_proxy', _('启用'));
        o.rmempty = false;

        o = s.taboption('lan', form.DynamicList, 'lan_inbound_interface', _('入口接口'));
        o.retain = true;
        o.rmempty = false;
        o.depends('lan_proxy', '1');

        for (const network of networks) {
            if (network.getName() === 'loopback') {
                continue;
            }
            o.value(network.getName());
        }

        o = s.taboption('lan', form.SectionValue, '_lan_access_control', form.TableSection, 'lan_access_control', _('访问控制'));
        o.retain = true;
        o.depends('lan_proxy', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('启用'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'ip', 'IP');
        so.datatype = 'ip4addr';

        for (const mac in hosts) {
            const host = hosts[mac];
            for (const ip of host.ipaddrs) {
                const hint = host.name ?? mac;
                so.value(ip, hint ? '%s (%s)'.format(ip, hint) : ip);
            };
        };

        so = o.subsection.option(form.DynamicList, 'ip6', 'IP6');
        so.datatype = 'ip6addr';

        for (const mac in hosts) {
            const host = hosts[mac];
            for (const ip of host.ip6addrs) {
                const hint = host.name ?? mac;
                so.value(ip, hint ? '%s (%s)'.format(ip, hint) : ip);
            };
        };

        so = o.subsection.option(form.DynamicList, 'mac', 'MAC');
        so.datatype = 'macaddr';

        for (const mac in hosts) {
            const host = hosts[mac];
            const hint = host.name ?? host.ipaddrs[0];
            so.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
        };

        so = o.subsection.option(form.Flag, 'dns', _('DNS'));
        so.rmempty = false;

        so = o.subsection.option(form.Flag, 'proxy', _('代理'));
        so.rmempty = false;

        s.tab('bypass', _('绕过规则'));

        o = s.taboption('bypass', form.Flag, 'bypass_china_mainland_ip', _('绕过中国大陆 IPv4'));
        o.rmempty = false;

        o = s.taboption('bypass', form.Flag, 'bypass_china_mainland_ip6', _('绕过中国大陆 IPv6'));
        o.rmempty = false;

        o = s.taboption('bypass', form.Flag, 'bypass_china_mainland_domain', _('绕过中国大陆域名'));
        o.description = _('使用 sing-box 原生远程规则集 geosite-cn，由 sing-box 按更新间隔自动刷新并缓存，无需本地维护域名表。');
        o.rmempty = false;

        o = s.taboption('bypass', form.Value, 'geosite_cn_url', _('geosite-cn 规则集地址'));
        o.depends('bypass_china_mainland_domain', '1');
        o.placeholder = 'https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs';

        o = s.taboption('bypass', form.Value, 'geosite_update_interval', _('geosite 更新间隔'));
        o.depends('bypass_china_mainland_domain', '1');
        o.placeholder = '168h';
        o.value('24h', _('1 天'));
        o.value('72h', _('3 天'));
        o.value('168h', _('7 天'));

        o = s.taboption('bypass', form.Value, 'geosite_download_detour', _('geosite 下载出站'));
        o.depends('bypass_china_mainland_domain', '1');
        o.description = _('留空使用默认路由出站；可填某个出站标签让规则集通过代理下载。');

        o = s.taboption('bypass', form.Value, 'geoip_v4_url', _('大陆 IPv4 列表地址'));
        o.placeholder = 'https://raw.githubusercontent.com/gaoyifan/china-operator-ip/ip-lists/china.txt';

        o = s.taboption('bypass', form.Value, 'geoip_v6_url', _('大陆 IPv6 列表地址'));
        o.placeholder = 'https://raw.githubusercontent.com/gaoyifan/china-operator-ip/ip-lists/china6.txt';

        o = s.taboption('bypass', form.Flag, 'bypass_geo_auto_update', _('自动更新大陆 IP 库'));
        o.description = _('定时从上面的列表地址刷新大陆 IPv4/IPv6 nft 集合（域名规则集由 sing-box 自行更新，不走这里）。');
        o.rmempty = false;

        o = s.taboption('bypass', form.ListValue, 'bypass_geo_update_interval', _('更新频率'));
        o.value('daily', _('每天'));
        o.value('weekly', _('每周'));
        o.value('monthly', _('每月'));
        o.default = 'weekly';
        o.depends('bypass_geo_auto_update', '1');

        o = s.taboption('bypass', form.Button, '_update_geo_rules', _('更新大陆 IP 库'));
        o.inputtitle = _('立即更新');
        o.inputstyle = 'apply';
        o.onclick = function (ev) {
            momo.stopButtonEvent(ev);
            return momo.updateGeoRules();
        };

        o = s.taboption('bypass', form.DynamicList, 'bypass_domain', _('自定义直连域名'));
        o.placeholder = 'example.com';

        o = s.taboption('bypass', form.DynamicList, 'force_proxy_domain', _('强制代理域名（绕过例外）'));
        o.description = _('这里的域名不受“绕过中国大陆域名”影响，强制走代理，优先级高于 geosite-cn 和自定义直连。');
        o.placeholder = 'example.com';

        o = s.taboption('bypass', form.DynamicList, 'force_proxy_ip', _('强制代理 IPv4（绕过例外）'));
        o.description = _('这里的 IP 不受“绕过中国大陆 IPv4”影响，强制走代理。');
        o.datatype = 'cidr4';
        o.placeholder = '1.2.3.0/24';

        o = s.taboption('bypass', form.DynamicList, 'force_proxy_ip6', _('强制代理 IPv6（绕过例外）'));
        o.description = _('这里的 IP 不受“绕过中国大陆 IPv6”影响，强制走代理。');
        o.datatype = 'cidr6';
        o.placeholder = '2001:db8::/32';

        o = s.taboption('bypass', form.Value, 'proxy_tcp_dport', _('需要代理的 TCP 目标端口'));
        o.rmempty = false;
        o.value('0-65535', _('所有端口'));
        o.value('21 22 80 110 143 194 443 465 853 993 995 8080 8443', _('常用端口'));

        o = s.taboption('bypass', form.Value, 'proxy_udp_dport', _('需要代理的 UDP 目标端口'));
        o.rmempty = false;
        o.value('0-65535', _('所有端口'));
        o.value('123 443 8443', _('常用端口'));

        o = s.taboption('bypass', form.DynamicList, 'bypass_dscp', _('绕过 DSCP'));
        o.datatype = 'range(0, 63)';

        o = s.taboption('bypass', form.DynamicList, 'bypass_fwmark', _('绕过 FWMark'));

        s.tab('misc', _('其他'));

        o = s.taboption('misc', form.DynamicList, 'reserved_ip', _('保留 IPv4'));
        o.datatype = 'ip4addr';

        o = s.taboption('misc', form.DynamicList, 'reserved_ip6', _('保留 IPv6'));
        o.datatype = 'ip6addr';

        o = s.taboption('misc', form.Value, 'tun_timeout', _('等待 TUN 设备超时(秒)'));
        o.datatype = 'uinteger';
        o.rmempty = false;

        o = s.taboption('misc', form.Value, 'tun_interval', _('检查 TUN 设备间隔(秒)'));
        o.datatype = 'uinteger';
        o.rmempty = false;

        return m.render().then(normalizeButtons);
    }
});
