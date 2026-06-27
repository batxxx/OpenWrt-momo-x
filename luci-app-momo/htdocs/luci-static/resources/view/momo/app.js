'use strict';
'require form';
'require view';
'require uci';
'require poll';
'require tools.momo as momo';

function renderStatus(running) {
    return updateStatus(E('input', { id: 'core_status', style: 'border: unset; font-style: italic; font-weight: bold;', readonly: '' }), running);
}

function updateStatus(element, running) {
    if (element) {
        element.style.color = running ? 'green' : 'red';
        element.value = running ? _('Running') : _('Not Running');
    }
    return element;
}

function formatFeature(value) {
    return value ? _('可用') : _('不可用');
}

function installStyle() {
    if (document.getElementById('momo-app-style')) {
        return;
    }

    document.head.appendChild(E('style', { id: 'momo-app-style' }, `
        .momo-status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            width: 100%;
        }
        .momo-runtime-card {
            border: 1px solid var(--border-color-medium, #d9e0e7);
            border-radius: 8px;
            padding: 12px 14px;
            background: var(--background-color-high, #fff);
        }
        .momo-runtime-title {
            color: var(--text-color-medium, #6b778d);
            font-size: 12px;
            margin-bottom: 6px;
        }
        .momo-runtime-value {
            color: var(--text-color-high, #1f2d4d);
            font-weight: 700;
        }
        .momo-runtime-ok {
            color: var(--success-color, #238636);
        }
        .momo-runtime-warn {
            color: var(--warning-color, #b26a00);
        }
    `));
}

function runtimeCard(title, value, ok) {
    const cls = ok === false ? 'momo-runtime-value momo-runtime-warn' : 'momo-runtime-value momo-runtime-ok';
    return E('div', { class: 'momo-runtime-card' }, [
        E('div', { class: 'momo-runtime-title' }, title),
        E('div', { class: cls }, value)
    ]);
}

function renderRuntimeSummary(features) {
    const transparentProxyReady = !!(features.has_firewall4 && features.has_nft_tproxy && features.has_tun);
    const sandbox = features.has_ujail ? _('可开启') : _('不可用');

    return E('div', { class: 'momo-status-grid' }, [
        runtimeCard(_('系统内核'), features.kernel || _('未知'), true),
        runtimeCard(_('透明代理环境'), transparentProxyReady ? _('可用') : _('需要检查依赖'), transparentProxyReady),
        runtimeCard(_('TUN 模式'), formatFeature(features.has_tun), !!features.has_tun),
        runtimeCard(_('沙箱隔离'), sandbox, !!features.has_ujail)
    ]);
}

function addScheduleOptions(section, flagName, prefix, labels, defaultTime) {
    let o;

    o = section.option(form.ListValue, prefix + '_mode', labels.mode);
    o.default = 'appointment';
    o.rmempty = false;
    o.depends(flagName, '1');
    o.value('appointment', _('预约'));
    o.value('cycle', _('循环'));

    o = section.option(form.ListValue, prefix + '_weekday', labels.weekday);
    o.default = '*';
    o.rmempty = false;
    o.depends({ [flagName]: '1', [prefix + '_mode']: 'appointment' });
    o.value('*', _('每天'));
    o.value('1', _('每周一'));
    o.value('2', _('每周二'));
    o.value('3', _('每周三'));
    o.value('4', _('每周四'));
    o.value('5', _('每周五'));
    o.value('6', _('每周六'));
    o.value('0', _('每周日'));

    o = section.option(form.ListValue, prefix + '_time', labels.time);
    o.default = defaultTime || '03:00';
    o.rmempty = false;
    o.depends({ [flagName]: '1', [prefix + '_mode']: 'appointment' });
    for (let hour = 0; hour < 24; hour++) {
        const value = String(hour).padStart(2, '0') + ':00';
        o.value(value, hour + ':00');
    }

    o = section.option(form.ListValue, prefix + '_interval', labels.interval);
    o.default = '1440';
    o.rmempty = false;
    o.depends({ [flagName]: '1', [prefix + '_mode']: 'cycle' });
    o.value('5', _('5 分钟'));
    o.value('10', _('10 分钟'));
    o.value('15', _('15 分钟'));
    o.value('20', _('20 分钟'));
    o.value('30', _('30 分钟'));
    o.value('60', _('1 小时'));
    o.value('120', _('2 小时'));
    o.value('180', _('3 小时'));
    o.value('360', _('6 小时'));
    o.value('720', _('12 小时'));
    o.value('1440', _('24 小时'));
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('momo'),
            momo.version(),
            momo.status(),
            momo.listProfiles(),
            momo.features()
        ]);
    },
    render: function (data) {
        const subscriptions = uci.sections('momo', 'subscription');
        const appVersion = data[1].app ?? '';
        const coreVersion = data[1].core ?? '';
        const running = data[2];
        const profiles = data[3];
        const features = data[4] ?? {};

        let m, s, o;

        installStyle();

        m = new form.Map('momo', _('Momo-X'), `${_('基于 sing-box 的 OpenWrt 透明代理。')} <a href="https://github.com/batxxx/OpenWrt-momo-x/wiki" target="_blank">${_('使用说明')}</a>`);

        s = m.section(form.TableSection, 'placeholder', _('运行状态'));
        s.anonymous = true;

        o = s.option(form.Value, '_app_version', _('插件版本'));
        o.readonly = true;
        o.load = function () {
            return appVersion;
        };
        o.write = function () { };

        o = s.option(form.Value, '_core_version', _('核心版本'));
        o.readonly = true;
        o.load = function () {
            return coreVersion;
        };
        o.write = function () { };

        o = s.option(form.DummyValue, '_core_status', _('核心状态'));
        o.cfgvalue = function () {
            return renderStatus(running);
        };
        poll.add(function () {
            return L.resolveDefault(momo.status()).then(function (running) {
                updateStatus(document.getElementById('core_status'), running);
            });
        });

        o = s.option(form.Button, 'restart');
        o.inputstyle = 'negative';
        o.inputtitle = _('重启服务');
        o.onclick = function (ev) {
            momo.stopButtonEvent(ev);
            return momo.restart();
        };

        o = s.option(form.Button, 'update_dashboard');
        o.inputstyle = 'positive';
        o.inputtitle = _('更新 Web 面板');
        o.onclick = function (ev) {
            momo.stopButtonEvent(ev);
            return momo.updateDashboard();
        };

        o = s.option(form.Button, 'open_dashboard');
        o.inputtitle = _('打开 Web 面板');
        o.onclick = function (ev) {
            momo.stopButtonEvent(ev);
            return momo.openDashboard();
        };

        s = m.section(form.TableSection, 'placeholder', _('运行环境'));
        s.anonymous = true;
        s.description = _('这里只显示普通使用需要关注的环境状态。底层进程和资源限制在“高级运行配置”中调整，通常保持默认即可。');

        o = s.option(form.DummyValue, '_runtime_summary', _('环境状态'));
        o.cfgvalue = function () {
            return renderRuntimeSummary(features);
        };
        o.write = function () { };

        s = m.section(form.NamedSection, 'config', 'config', _('插件配置'));

        o = s.option(form.Flag, 'enabled', _('启用'));
        o.rmempty = false;

        o = s.option(form.ListValue, 'profile', _('运行配置'));
        o.optional = true;
        o.description = _('选择当前要运行的配置文件或订阅生成的配置。');

        for (const profile of profiles) {
            o.value('file:' + profile.name, _('配置文件：') + profile.name);
        };

        for (const subscription of subscriptions.filter((x) => x.enabled !== '0')) {
            o.value('subscription:' + subscription['.name'], _('订阅：') + subscription.name);
        };

        o = s.option(form.Value, 'start_delay', _('启动延迟'));
        o.datatype = 'uinteger';
        o.placeholder = _('立即启动');
        o.description = _('路由器开机后延迟多少秒启动 momo，普通场景保持 0 即可。');

        o = s.option(form.Flag, 'scheduled_restart', _('定时重启'));
        o.rmempty = false;
        o.description = _('用于定期重启 momo 服务。一般不需要开启；只有遇到长期运行异常时再使用。');

        addScheduleOptions(s, 'scheduled_restart', 'scheduled_restart', {
            mode: _('重启模式'),
            weekday: _('重启日期(每周)'),
            time: _('重启时间(每天)'),
            interval: _('重启间隔(分钟)')
        }, '03:00');

        o = s.option(form.Flag, 'test_profile', _('启动前检查配置'));
        o.rmempty = false;
        o.description = _('启动前先用 sing-box 检查配置文件，检查失败就不启动，建议保持开启。');

        o = s.option(form.Flag, 'core_only', _('仅核心模式'));
        o.rmempty = false;
        o.description = _('只启动 sing-box 核心，不写入 momo 的透明代理混入配置，也不设置防火墙/TUN/TPROXY 劫持。适合完全手写配置或调试；普通透明代理使用不要开启。');

        s = m.section(form.NamedSection, 'procd', 'procd', _('高级运行配置'));
        s.description = _('procd 是 OpenWrt 的服务管理器。这里控制 momo 进程如何被守护、重载、限制资源和设置运行环境；不熟悉时建议保持默认。');

        s.tab('general', _('进程管理'));

        o = s.taboption('general', form.Flag, 'fast_reload', _('快速重载'));
        o.rmempty = false;
        o.description = _('启用后，配置刷新会优先向核心发送 HUP 信号，速度更快；如果遇到配置未完整刷新，再关闭。');

        o = s.taboption('general', form.Flag, 'quic_go_disable_gso_auto', _('自动禁用 QUIC GSO'));
        o.rmempty = false;
        o.description = _('用于规避部分 Linux 6.6 内核上的 QUIC GSO 兼容问题，建议保持默认。');

        o = s.taboption('general', form.Flag, 'enable_ujail', _('启用 ujail 沙箱'));
        o.rmempty = false;
        o.description = _('用 OpenWrt 的 ujail 限制核心进程可访问的文件和权限。开启前请确认系统已安装 ujail。');

        s.tab('rlimit', _('资源限制'));

        o = s.taboption('rlimit', form.Value, 'rlimit_nproc_soft', _('进程数软限制'));
        o.datatype = 'uinteger';

        o = s.taboption('rlimit', form.Value, 'rlimit_nproc_hard', _('进程数硬限制'));
        o.datatype = 'uinteger';

        o = s.taboption('rlimit', form.Value, 'rlimit_address_space_soft', _('地址空间软限制'));
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        o = s.taboption('rlimit', form.Value, 'rlimit_address_space_hard', _('地址空间硬限制'));
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        o = s.taboption('rlimit', form.Value, 'rlimit_data_soft', _('堆内存软限制'));
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        o = s.taboption('rlimit', form.Value, 'rlimit_data_hard', _('堆内存硬限制'));
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        o = s.taboption('rlimit', form.Value, 'rlimit_stack_soft', _('栈内存软限制'));
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        o = s.taboption('rlimit', form.Value, 'rlimit_stack_hard', _('栈内存硬限制'));
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        o = s.taboption('rlimit', form.Value, 'rlimit_nofile_soft', _('打开文件数软限制'));
        o.datatype = 'uinteger';

        o = s.taboption('rlimit', form.Value, 'rlimit_nofile_hard', _('打开文件数硬限制'));
        o.datatype = 'uinteger';

        s.tab('environment_variable', _('环境变量'));

        o = s.taboption('environment_variable', form.Value, 'env_go_max_procs', 'GOMAXPROCS');
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        o = s.taboption('environment_variable', form.Value, 'env_go_mem_limit', 'GOMEMLIMIT');
        o.datatype = 'uinteger';
        o.placeholder = _('不限制');

        return m.render().then(function (node) {
            node.querySelectorAll('button').forEach(function (button) {
                button.setAttribute('type', 'button');
            });
            return node;
        });
    }
});
