'use strict';
'require form';
'require view';
'require uci';

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
        ]);
    },
    render: function (data) {
        let m, s, o;

        m = new form.Map('momo');

        s = m.section(form.NamedSection, 'mixin', 'mixin', _('混入配置'));
        s.description = _('这些选项会在启动或重载时写入当前运行配置。留空表示不覆盖订阅/配置文件里的原始设置。');

        s.tab('log', _('日志配置'));

        o = s.taboption('log', form.ListValue, 'log_disabled', _('禁用日志'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('否'));
        o.value('1', _('是'));
        
        o = s.taboption('log', form.ListValue, 'log_level', _('日志级别'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('panic');
        o.value('fatal');
        o.value('error');
        o.value('warn');
        o.value('info');
        o.value('debug');
        o.value('trace');

        o = s.taboption('log', form.ListValue, 'log_timestamp', _('打印时间戳'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('禁用'));
        o.value('1', _('启用'));

        o = s.taboption('log', form.Value, 'log_output', _('日志输出路径'));
        o.placeholder = _('不修改');

        s.tab('dns', _('DNS 配置'));

        o = s.taboption('dns', form.ListValue, 'dns_strategy', _('DNS 解析策略'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('prefer_ipv4', _('Prefer IPv4'));
        o.value('prefer_ipv6', _('Prefer IPv6'));
        o.value('ipv4_only', _('IPv4 Only'));
        o.value('ipv6_only', _('IPv6 Only'));

        o = s.taboption('dns', form.ListValue, 'dns_disable_cache', _('禁用 DNS 缓存'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('否'));
        o.value('1', _('是'));

        o = s.taboption('dns', form.ListValue, 'dns_disable_expire', _('禁用 DNS 缓存过期'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('否'));
        o.value('1', _('是'));

        o = s.taboption('dns', form.ListValue, 'dns_independent_cache', _('独立 DNS 缓存'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('禁用'));
        o.value('1', _('启用'));

        o = s.taboption('dns', form.Value, 'dns_cache_capacity', _('DNS 缓存容量'));
        o.datatype = 'uinteger';
        o.placeholder = _('不修改');

        o = s.taboption('dns', form.ListValue, 'dns_reverse_mapping', _('DNS 反向映射'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('禁用'));
        o.value('1', _('启用'));

        s.tab('ntp', _('NTP 配置'));

        o = s.taboption('ntp', form.ListValue, 'ntp_enabled', _('启用 NTP'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('禁用'));
        o.value('1', _('启用'));

        o = s.taboption('ntp', form.Value, 'ntp_server', _('NTP 服务器'));
        o.placeholder = _('不修改');

        o = s.taboption('ntp', form.Value, 'ntp_server_port', _('NTP 服务器端口'));
        o.datatype = 'port';
        o.placeholder = _('不修改');

        o = s.taboption('ntp', form.Value, 'ntp_interval', _('NTP 同步间隔'));
        o.placeholder = _('不修改');

        s.tab('cache', _('缓存配置'));

        o = s.taboption('cache', form.ListValue, 'cache_enabled', _('启用缓存文件'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('禁用'));
        o.value('1', _('启用'));

        o = s.taboption('cache', form.Value, 'cache_path', _('缓存文件路径'));
        o.placeholder = _('不修改');

        o = s.taboption('cache', form.ListValue, 'cache_store_fakeip', _('保存 FakeIP 缓存'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('禁用'));
        o.value('1', _('启用'));

        o = s.taboption('cache', form.ListValue, 'cache_store_rdrc', _('保存 RDRC 缓存'));
        o.optional = true;
        o.placeholder = _('不修改');
        o.value('0', _('禁用'));
        o.value('1', _('启用'));

        s.tab('external_control', _('外部控制'));

        o = s.taboption('external_control', form.Value, 'external_control_ui_path', _('面板路径'));
        o.placeholder = _('不修改');

        o = s.taboption('external_control', form.Value, 'external_control_ui_download_url', _('面板下载地址'));
        o.placeholder = _('不修改');
        o.value('https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip', 'Zashboard (CDN Fonts)');
        o.value('https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip', 'Zashboard');
        o.value('https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip', 'MetaCubeXD');
        o.value('https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip', 'YACD');
        o.value('https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip', 'Razord');

        o = s.taboption('external_control', form.Value, 'external_control_ui_download_detour', _('面板下载出站'));
        o.placeholder = 'direct';

        o = s.taboption('external_control', form.Value, 'external_control_api_listen', _('API 监听地址'));
        o.datatype = 'ipaddrport(1)';
        o.placeholder = _('不修改');

        o = s.taboption('external_control', form.Value, 'external_control_api_secret', _('API 密钥'));
        o.password = true;
        o.placeholder = _('不修改');

        return m.render().then(normalizeButtons);
    }
});
