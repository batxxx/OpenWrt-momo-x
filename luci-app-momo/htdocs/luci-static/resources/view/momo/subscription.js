'use strict';
'require form';
'require view';
'require uci';
'require tools.momo as momo';

function actionButton(title, style, onclick) {
    return E('button', {
        type: 'button',
        class: 'btn cbi-button cbi-button-' + (style || 'button'),
        click: function (ev) {
            momo.stopButtonEvent(ev);
            return onclick(ev);
        }
    }, title);
}

function displayValue(value, fallback) {
    value = value == null ? '' : String(value);
    return value || fallback || '无';
}

function statusText(value) {
    if (value === '1') {
        return '成功';
    }
    if (value === '0') {
        return '失败';
    }
    return displayValue(value);
}

function reloadMomoConfig() {
    if (uci.unload) {
        uci.unload('momo');
    }
    return uci.load('momo');
}

function findSubscription(section_id) {
    return uci.sections('momo', 'subscription').find(function (item) {
        return item['.name'] === section_id;
    }) || null;
}

function updateSubscriptionRowCells(row, section) {
    if (!row || !section) {
        return;
    }

    const cells = row.querySelectorAll('.td');
    if (cells.length < 10) {
        return;
    }

    cells[4].textContent = statusText(section.success);
    cells[5].textContent = displayValue(section.error);
    cells[6].textContent = displayValue(section.used);
    cells[7].textContent = displayValue(section.total);
    cells[8].textContent = displayValue(section.expire);
    cells[9].textContent = displayValue(section.update);
}

function findSubscriptionRow(root, section_id) {
    const rows = root ? root.querySelectorAll('.cbi-section-table-row') : [];
    for (const row of rows) {
        if (row.getAttribute('data-momo-subscription-section') === section_id) {
            return row;
        }
    }
    return null;
}

function tagSubscriptionRows(root) {
    const sections = uci.sections('momo', 'subscription');
    const rows = root ? root.querySelectorAll('.cbi-section-table-row') : [];
    sections.forEach(function (section, index) {
        const row = rows[index];
        if (!row) {
            return;
        }
        row.setAttribute('data-momo-subscription-section', section['.name']);
        updateSubscriptionRowCells(row, section);
    });
}

function refreshSubscriptionRow(root, section_id) {
    return reloadMomoConfig().then(function () {
        const section = findSubscription(section_id);
        updateSubscriptionRowCells(findSubscriptionRow(root, section_id), section);
    });
}

function refreshSubscriptionRows(root) {
    return reloadMomoConfig().then(function () {
        tagSubscriptionRows(root);
    });
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('momo'),
            momo.features(),
        ]);
    },
    render: function (data) {
        const features = data[1] || {};
        const localConverter = features.local_subconverter || {};
        const localConverterUrl = localConverter.url || 'http://127.0.0.1:25500/sub';
        const preferLocalConverter = !!localConverter.running || uci.get('momo', 'local_subconverter', 'enabled') === '1';
        let rootNode = null;
        let m, s, o;

        m = new form.Map('momo');

        s = m.section(form.NamedSection, 'config', 'config', '订阅管理');

        o = s.option(form.Flag, 'subscription_scheduled_update', '自动更新');
        o.rmempty = false;

        o = s.option(form.ListValue, 'subscription_update_mode', '更新模式');
        o.default = 'appointment';
        o.rmempty = false;
        o.depends('subscription_scheduled_update', '1');
        o.value('appointment', '预约');
        o.value('cycle', '循环');

        o = s.option(form.ListValue, 'subscription_update_weekday', '更新日期(每周)');
        o.default = '*';
        o.rmempty = false;
        o.depends({ subscription_scheduled_update: '1', subscription_update_mode: 'appointment' });
        o.value('*', '每天');
        o.value('1', '每周一');
        o.value('2', '每周二');
        o.value('3', '每周三');
        o.value('4', '每周四');
        o.value('5', '每周五');
        o.value('6', '每周六');
        o.value('0', '每周日');

        o = s.option(form.ListValue, 'subscription_update_time', '更新时间(每天)');
        o.default = '04:00';
        o.rmempty = false;
        o.depends({ subscription_scheduled_update: '1', subscription_update_mode: 'appointment' });
        for (let hour = 0; hour < 24; hour++) {
            const value = String(hour).padStart(2, '0') + ':00';
            o.value(value, hour + ':00');
        }

        o = s.option(form.ListValue, 'subscription_update_interval', '更新间隔(分钟)');
        o.default = '60';
        o.rmempty = false;
        o.depends({ subscription_scheduled_update: '1', subscription_update_mode: 'cycle' });
        o.value('5', '5 分钟');
        o.value('10', '10 分钟');
        o.value('15', '15 分钟');
        o.value('20', '20 分钟');
        o.value('30', '30 分钟');
        o.value('60', '1 小时');
        o.value('120', '2 小时');
        o.value('180', '3 小时');
        o.value('360', '6 小时');
        o.value('720', '12 小时');
        o.value('1440', '24 小时');

        o = s.option(form.DummyValue, '_update_all_subscriptions', '更新全部订阅');
        o.cfgvalue = function () {
            return actionButton('更新全部订阅', 'positive', function () {
                return momo.updateSubscriptions().then(function () {
                    return refreshSubscriptionRows(rootNode);
                });
            });
        };
        o.write = function () { };

        s = m.section(form.NamedSection, 'local_subconverter', 'local_subconverter', '本地订阅转换服务');

        o = s.option(form.Flag, 'enabled', '启用本地服务');
        o.default = '0';
        o.rmempty = false;

        o = s.option(form.Value, 'port', '监听端口');
        o.default = '25500';
        o.datatype = 'port';
        o.rmempty = false;

        o = s.option(form.DummyValue, '_status', '状态');
        o.rawhtml = true;
        o.cfgvalue = function () {
            if (localConverter.running) {
                return '<span style="color:var(--success-color,#2e7d32)">运行中</span>';
            }
            if (localConverter.installed) {
                return '<span style="color:var(--warning-color,#b26a00)">已安装，未运行</span>';
            }
            return '<span style="color:var(--error-color,#c62828)">未安装</span>';
        };

        o = s.option(form.Value, 'url', '本地转换地址');
        o.default = 'http://127.0.0.1:25500/sub';
        o.rmempty = false;

        o = s.option(form.DummyValue, '_version', '版本');
        o.cfgvalue = function () {
            return localConverter.version || '不可用';
        };

        o = s.option(form.DummyValue, '_restart_local_subconverter', '重启本地转换服务');
        o.cfgvalue = function () {
            return actionButton('重启本地转换服务', 'apply', function () {
                return momo.restartLocalSubconverter();
            });
        };
        o.write = function () { };

        s = m.section(form.GridSection, 'subscription', '远程订阅');
        s.addremove = true;
        s.anonymous = true;
        s.sortable = true;
        s.modaltitle = '编辑订阅';

        o = s.option(form.Flag, 'enabled', '启用');
        o.default = '1';
        o.rmempty = false;
        o.modalonly = false;

        o = s.option(form.Value, 'name', '订阅名称');
        o.rmempty = false;

        o = s.option(form.DummyValue, '_remark_display', '备注');
        o.modalonly = false;
        o.cfgvalue = function (section_id) {
            return uci.get('momo', section_id, 'remark') || '-';
        };

        o = s.option(form.DummyValue, '_url_display', '订阅链接');
        o.modalonly = false;
        o.cfgvalue = function (section_id) {
            return displayValue(uci.get('momo', section_id, 'url') || uci.get('momo', section_id, 'info_url'));
        };

        o = s.option(form.Value, 'url', '订阅链接');
        o.modalonly = true;
        o.rmempty = true;
        o.cfgvalue = function (section_id) {
            return uci.get('momo', section_id, 'url') || uci.get('momo', section_id, 'info_url') || '';
        };

        o = s.option(form.ListValue, 'success', '状态');
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;
        o.value('1', '成功');
        o.value('0', '失败');

        o = s.option(form.Value, 'error', '错误');
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Value, 'used', '已使用');
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Value, 'total', '总量');
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Value, 'expire', '到期时间');
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Value, 'update', '更新时间');
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Button, '_update_subscription');
        o.editable = true;
        o.inputstyle = 'positive';
        o.inputtitle = '更新';
        o.modalonly = false;
        o.onclick = function (ev, section_id) {
            momo.stopButtonEvent(ev);
            return momo.updateSubscription(section_id).then(function () {
                return refreshSubscriptionRow(rootNode, section_id);
            });
        };

        o = s.option(form.Button, '_open_subscription_profile');
        o.editable = true;
        o.inputtitle = '查看配置';
        o.modalonly = false;
        o.onclick = function (ev, section_id) {
            momo.stopButtonEvent(ev);
            const section = uci.sections('momo', 'subscription').find(function (item) {
                return item['.name'] === section_id;
            }) || {};
            const file = section.output_file || (section_id + '.json');
            window.location.href = L.url('admin/services/momo/profile/editor') + '?file=' + encodeURIComponent('/etc/momo/subscriptions/' + file);
        };

        o = s.option(form.Value, 'info_url', '订阅信息链接');
        o.modalonly = true;
        o.description = '可选；如果订阅链接为空，会用这里的链接作为兼容回退。';

        o = s.option(form.Value, 'remark', '备注');
        o.modalonly = true;

        o = s.option(form.Value, 'user_agent', '用户代理（UA）');
        o.default = 'sing-box';
        o.modalonly = true;
        o.rmempty = false;
        o.value('sing-box');
        o.description = '默认使用 sing-box；如订阅服务有特殊要求，可直接输入自定义 UA。';

        o = s.option(form.Flag, 'convert', '在线订阅转换');
        o.default = '0';
        o.modalonly = true;
        o.rmempty = false;

        o = s.option(form.Value, 'convert_api', '订阅转换服务地址');
        o.default = preferLocalConverter ? localConverterUrl : 'https://api.asailor.org/sub';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');
        o.value(localConverterUrl, '本地 subconverter');
        o.value('https://api.asailor.org/sub', 'api.asailor.org');
        o.value('https://api.wcc.best/sub', 'api.wcc.best');

        o = s.option(form.ListValue, 'convert_target', '转换目标');
        o.default = 'singbox';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');
        o.value('singbox', 'sing-box');

        o = s.option(form.ListValue, 'convert_template', '订阅转换模板');
        o.default = 'config/momo-x_lhie1_dler.ini';
        o.modalonly = true;
        o.depends('convert', '1');
        o.description = '本地模板会随 momo-x 一起安装，更新订阅时不再从 GitHub 拉取模板和规则集。';
        o.value('', '服务默认模板');
        o.value('config/momo-x_lhie1_dler.ini', 'lhie1 洞主规则完整版（本地）');
        o.value('custom', '自定义模板 URL');
        o.cfgvalue = function (section_id) {
            const value = uci.get('momo', section_id, 'convert_template') || '';
            if (value === 'https://gist.githubusercontent.com/tindy2013/1fa08640a9088ac8652dbd40c5d2715b/raw/lhie1_dler.ini' ||
                value === '/etc/momo/subconverter/momo-x/config/lhie1_dler.ini' ||
                value === '/etc/momo/subconverter/config/momo-x_lhie1_dler.ini') {
                return 'config/momo-x_lhie1_dler.ini';
            }
            return value;
        };

        o = s.option(form.Value, 'convert_custom_template', '自定义模板 URL');
        o.modalonly = true;
        o.depends('convert_template', 'custom');

        o = s.option(form.Value, 'filter_keywords', '筛选节点');
        o.modalonly = true;
        o.depends('convert', '1');
        o.placeholder = '香港 或 台湾&bgp';

        o = s.option(form.Value, 'exclude_keywords', '排除节点');
        o.modalonly = true;
        o.depends('convert', '1');
        o.placeholder = '官网|到期|流量';

        o = s.option(form.Flag, 'exclude_invalid', '排除无效节点');
        o.default = '1';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');

        o = s.option(form.Flag, 'convert_emoji', '添加 Emoji');
        o.default = '0';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');

        o = s.option(form.Flag, 'convert_udp', 'UDP 支持');
        o.default = '1';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');

        o = s.option(form.Flag, 'convert_skip_cert_verify', '跳过证书验证');
        o.default = '0';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');

        o = s.option(form.Flag, 'convert_sort', '排序');
        o.default = '0';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');

        o = s.option(form.Flag, 'convert_node_type', '插入节点类型');
        o.default = '0';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');

        o = s.option(form.Flag, 'convert_rule_provider', '节点列表兼容模式');
        o.default = '1';
        o.modalonly = true;
        o.rmempty = false;
        o.depends('convert', '1');
        o.description = '作为模板规则失败时的回退模式使用：稳定生成 momo 可启动的节点列表配置。';

        o = s.option(form.Flag, 'allow_insecure', '允许不安全连接');
        o.default = '0';
        o.modalonly = true;
        o.rmempty = false;

        o = s.option(form.Value, 'download_proxy', '下载代理');
        o.modalonly = true;
        o.placeholder = 'http://127.0.0.1:7890';

        o = s.option(form.ListValue, 'prefer', '启动时使用方式');
        o.default = 'remote';
        o.modalonly = true;
        o.description = '远程订阅：启动或切换时优先重新下载并转换订阅；本地缓存：如果已有上次生成的配置文件就直接使用，只有缓存不存在时才重新下载。';
        o.value('remote', '优先更新远程订阅');
        o.value('local', '优先使用本地缓存');

        return m.render().then(function (node) {
            rootNode = node;
            node.querySelectorAll('button').forEach(function (button) {
                button.setAttribute('type', 'button');
            });
            tagSubscriptionRows(node);
            return node;
        });
    }
});
