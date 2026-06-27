'use strict';
'require view';
'require uci';
'require fs';
'require ui';
'require tools.momo as momo';

const RULE_FIELDS = [
    ['domain', '完整域名'],
    ['domain_suffix', '域名后缀'],
    ['domain_keyword', '域名关键词'],
    ['domain_regex', '域名正则'],
    ['ip_cidr', 'IP CIDR'],
    ['rule_set', '规则集']
];

const MANAGED_SELECTOR_TAG = '所有节点';
const MANAGED_URLTEST_TAG = '所有节点 自动选择';
const LEGACY_MANAGED_SELECTOR_TAG = '规则附加';
const LEGACY_MANAGED_URLTEST_TAG = '规则附加 自动选择';
const SYSTEM_OUTBOUND_TYPES = {
    selector: true,
    urltest: true,
    direct: true,
    block: true,
    dns: true
};

function installStyle() {
    if (document.getElementById('momo-rule-append-style')) {
        return;
    }

    document.head.appendChild(E('style', { id: 'momo-rule-append-style' }, `
.momo-append-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.momo-append-toolbar select,
.momo-append-toolbar input[type="text"],
.momo-append-toolbar input[type="search"] {
    min-width: 240px;
}
.momo-append-grid {
    display: grid;
    gap: 8px;
}
.momo-append-card {
    border: 1px solid var(--border-color-medium, #dde3ea);
    border-radius: 8px;
    background: var(--background-color-high, #fff);
    overflow: hidden;
}
.momo-append-summary {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    cursor: pointer;
}
.momo-append-summary:hover {
    background: rgba(91, 141, 239, .06);
}
.momo-append-title {
    font-weight: 700;
    overflow-wrap: anywhere;
}
.momo-append-meta {
    color: #7c8aa5;
    font-size: 12px;
    margin-top: 3px;
}
.momo-chip-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
}
.momo-chip {
    display: inline-flex;
    align-items: center;
    max-width: 240px;
    padding: 3px 8px;
    border-radius: 999px;
    background: #eef3ff;
    color: #4d65b4;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.momo-chip-muted {
    background: #f0f2f5;
    color: #7c8aa5;
}
.momo-append-detail {
    border-top: 1px solid var(--border-color-medium, #dde3ea);
    padding: 12px 14px 14px;
}
.momo-detail-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}
.momo-detail-actions select,
.momo-detail-actions input[type="text"] {
    min-width: 220px;
}
.momo-rule-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 10px;
}
.momo-field label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-weight: 600;
    margin-bottom: 4px;
}
.momo-field-remove {
    min-width: auto;
    padding: 2px 8px;
}
.momo-field textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 116px;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.momo-empty-note {
    padding: 18px 10px;
    color: #7c8aa5;
}
@media (max-width: 760px) {
    .momo-append-summary {
        grid-template-columns: 1fr;
    }
    .momo-chip-row {
        justify-content: flex-start;
    }
}
`));
}

function parseRuleArray(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(function (rule) { return rule && typeof rule === 'object'; }) : [];
    } catch (e) {
        return [];
    }
}

function profileOutbounds(profile) {
    return momo.uniqueItems([MANAGED_SELECTOR_TAG, MANAGED_URLTEST_TAG, 'DIRECT', 'REJECT'].concat((profile.outbounds || []).map(function (outbound) {
        return outbound && outbound.tag;
    })));
}

function profileProxyNodes(profile) {
    return momo.uniqueItems((profile.outbounds || []).filter(function (outbound) {
        const tag = String(outbound && outbound.tag || '').trim();
        const type = String(outbound && outbound.type || '').trim();
        return tag && tag !== MANAGED_SELECTOR_TAG && tag !== MANAGED_URLTEST_TAG &&
            tag !== LEGACY_MANAGED_SELECTOR_TAG && tag !== LEGACY_MANAGED_URLTEST_TAG &&
            !SYSTEM_OUTBOUND_TYPES[type];
    }).map(function (outbound) {
        return outbound.tag;
    }));
}

function upsertOutbound(profile, outbound) {
    const tag = outbound && outbound.tag;
    if (!tag) {
        return;
    }
    const index = profile.outbounds.findIndex(function (item) {
        return item && item.tag === tag;
    });
    if (index >= 0) {
        profile.outbounds[index] = outbound;
    } else {
        profile.outbounds.unshift(outbound);
    }
}

function ensureManagedOutbounds(profile) {
    profile.outbounds = (profile.outbounds || []).filter(function (outbound) {
        const tag = String(outbound && outbound.tag || '').trim();
        return tag !== LEGACY_MANAGED_SELECTOR_TAG && tag !== LEGACY_MANAGED_URLTEST_TAG;
    });

    const nodes = profileProxyNodes(profile);
    if (nodes.length) {
        upsertOutbound(profile, {
            type: 'urltest',
            tag: MANAGED_URLTEST_TAG,
            outbounds: nodes,
            url: 'https://www.gstatic.com/generate_204',
            interval: '10m',
            tolerance: 50
        });
    }

    upsertOutbound(profile, {
        type: 'selector',
        tag: MANAGED_SELECTOR_TAG,
        outbounds: momo.uniqueItems((nodes.length ? [MANAGED_URLTEST_TAG] : []).concat(['DIRECT'], nodes))
    });

    return profile;
}

function missingRuleOutbounds(profile, rules) {
    const allowed = {};
    const missing = {};
    profileOutbounds(profile).forEach(function (tag) {
        allowed[tag] = true;
    });
    for (const rule of rules) {
        const outbound = String(rule && rule.outbound || '').trim();
        if (outbound && !allowed[outbound]) {
            missing[outbound] = true;
        }
    }
    return Object.keys(missing);
}

function normalizeManagedOutbound(outbound) {
    outbound = String(outbound || '').trim();
    return outbound === LEGACY_MANAGED_SELECTOR_TAG ? MANAGED_SELECTOR_TAG : outbound;
}

function setRuleField(rule, field, value) {
    const items = momo.linesToArray(value);
    if (items.length) {
        rule[field] = items;
    } else {
        delete rule[field];
    }
}

function cleanRule(rule) {
    const result = {};
    for (const key in rule) {
        if (key === '_pending' || key === '_custom') {
            continue;
        }
        if (key === 'outbound') {
            if (String(rule[key] || '').trim()) {
                result[key] = normalizeManagedOutbound(rule[key]);
            }
            continue;
        }
        if (RULE_FIELDS.some(function ([field]) { return field === key; })) {
            const values = momo.uniqueItems(momo.asArray(rule[key]));
            if (values.length) {
                result[key] = values;
            }
        }
    }
    return result.outbound ? result : null;
}

function ruleSummary(rule) {
    const parts = [];
    for (const [key, label] of RULE_FIELDS) {
        const count = momo.asArray(rule[key]).length;
        if (count) {
            parts.push(label + ' ' + count);
        }
    }
    return parts.length ? parts.join(' / ') : '未设置匹配条件';
}

function fieldPreview(rule) {
    const chips = [];
    for (const [key, label] of RULE_FIELDS) {
        const values = momo.asArray(rule[key]);
        if (!values.length) {
            continue;
        }
        chips.push(E('span', { class: 'momo-chip' }, label + ': ' + values.slice(0, 2).join(', ') + (values.length > 2 ? ' +' + (values.length - 2) : '')));
    }
    if (!chips.length) {
        chips.push(E('span', { class: 'momo-chip momo-chip-muted' }, '待添加匹配条件'));
    }
    return chips;
}

function buildRuleGroups(rules) {
    const map = {};
    const groups = [];
    for (const rule of rules) {
        const outbound = normalizeManagedOutbound(rule.outbound) || '未指定';
        if (!map[outbound]) {
            map[outbound] = { outbound: outbound, rule: { outbound: outbound }, count: 0 };
            groups.push(map[outbound]);
        }
        map[outbound].count++;
        for (const [field] of RULE_FIELDS) {
            const values = momo.uniqueItems(momo.asArray(map[outbound].rule[field]).concat(momo.asArray(rule[field])));
            if (values.length) {
                map[outbound].rule[field] = values;
            }
        }
    }
    return groups;
}

function flattenGroups(groups) {
    const rules = [];
    for (const group of groups) {
        const rule = cleanRule(group.rule);
        if (rule) {
            rules.push(rule);
        }
    }
    return rules;
}

function ruleKey(rule) {
    const normalized = {};
    const outbound = String(rule && rule.outbound || '').trim();
    if (outbound) {
        normalized.outbound = outbound;
    }

    for (const [field] of RULE_FIELDS) {
        const values = momo.uniqueItems(momo.asArray(rule && rule[field]));
        if (values.length) {
            normalized[field] = values;
        }
    }

    if (rule && typeof rule === 'object') {
        Object.keys(rule).sort().forEach(function (key) {
            if (key === 'outbound' || RULE_FIELDS.some(function ([field]) { return field === key; })) {
                return;
            }
            normalized[key] = rule[key];
        });
    }

    return JSON.stringify(normalized);
}

function mergeAppendRules(profile, prependRules, appendRules) {
    const existing = profile.route.rules || [];
    const seen = {};
    const result = [];

    function pushRule(rule) {
        const clean = cleanRule(rule) || rule;
        const key = ruleKey(clean);
        if (!seen[key]) {
            seen[key] = true;
            result.push(clean);
        }
    }

    prependRules.forEach(pushRule);
    existing.forEach(pushRule);
    appendRules.forEach(pushRule);
    profile.route.rules = result;
    return profile;
}

function renderAppendCard(group, index, expanded, pending, onToggle, onDelete, rerender) {
    const rule = group.rule;
    rule.outbound = normalizeManagedOutbound(rule.outbound) || '';
    const isManaged = !rule._custom && (rule.outbound === MANAGED_SELECTOR_TAG || !rule.outbound);
    if (isManaged) {
        rule.outbound = MANAGED_SELECTOR_TAG;
    }
    const outboundModeSelect = E('select', {}, [
        E('option', { value: 'managed', selected: isManaged ? 'selected' : null }, '所有节点'),
        E('option', { value: 'custom', selected: !isManaged ? 'selected' : null }, '自定义节点')
    ]);
    const customOutbound = E('input', {
        type: 'text',
        placeholder: '输入出站/节点组名称',
        value: isManaged ? '' : rule.outbound,
        style: isManaged ? 'display:none' : ''
    });
    outboundModeSelect.addEventListener('change', function () {
        if (outboundModeSelect.value === 'managed') {
            delete rule._custom;
            rule.outbound = MANAGED_SELECTOR_TAG;
            customOutbound.value = '';
        } else {
            rule._custom = true;
            rule.outbound = customOutbound.value.trim();
        }
        rerender();
    });
    customOutbound.addEventListener('input', function () {
        if (outboundModeSelect.value === 'custom') {
            rule.outbound = customOutbound.value.trim();
        }
    });

    const addFieldSelect = E('select', {}, [
        E('option', { value: '' }, '添加输入栏')
    ].concat(RULE_FIELDS.filter(function ([key]) {
        return momo.asArray(rule[key]).length === 0 && !pending[key];
    }).map(function ([key, label]) {
        return E('option', { value: key }, label);
    })));
    addFieldSelect.addEventListener('change', function () {
        if (!addFieldSelect.value) {
            return;
        }
        pending[addFieldSelect.value] = true;
        rerender();
    });

    const fields = RULE_FIELDS.filter(function ([key]) {
        return momo.asArray(rule[key]).length > 0 || pending[key];
    }).map(function ([key, label]) {
        const textarea = E('textarea', {}, momo.asArray(rule[key]).join('\n'));
        textarea.addEventListener('input', function () {
            setRuleField(rule, key, textarea.value);
        });
        return E('div', { class: 'momo-field' }, [
            E('label', {}, [
                E('span', {}, label),
                E('button', { type: 'button',
                    class: 'btn cbi-button cbi-button-remove momo-field-remove',
                    click: function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        delete rule[key];
                        delete pending[key];
                        rerender();
                    }
                }, '移除')
            ]),
            textarea
        ]);
    });

    const detail = expanded ? E('div', { class: 'momo-append-detail' }, [
        E('div', { class: 'momo-detail-actions' }, [
            E('label', {}, '使用节点'),
            outboundModeSelect,
            customOutbound,
            E('label', {}, '添加输入栏'),
            addFieldSelect,
            E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-negative',
                click: function (ev) {
                    ev.stopPropagation();
                    onDelete();
                }
            }, '删除规则')
        ]),
        fields.length ? E('div', { class: 'momo-rule-fields' }, fields) : E('div', { class: 'momo-empty-note' }, '这条附加规则还没有匹配条件，可以添加输入栏。')
    ]) : null;

    const children = [
        E('div', { class: 'momo-append-summary', click: onToggle }, [
            E('div', {}, [
                E('div', { class: 'momo-append-title' }, normalizeManagedOutbound(rule.outbound) || '未指定出站'),
                E('div', { class: 'momo-append-meta' }, '附加规则 #' + (index + 1) + ' · ' + ruleSummary(rule) + (group.count > 1 ? ' · 已合并 ' + group.count + ' 条' : ''))
            ]),
            E('div', { class: 'momo-chip-row' }, fieldPreview(rule)),
            E('span', { class: 'momo-chip momo-chip-muted' }, expanded ? '收起' : '展开')
        ])
    ];
    if (detail) {
        children.push(detail);
    }

    return E('div', { class: 'momo-append-card' }, children);
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('momo'),
            momo.getPaths(),
            momo.listProfiles(),
            momo.listSubscriptionFiles()
        ]);
    },

    render: function (data) {
        installStyle();

        const paths = data[1];
        const profiles = (data[2] || []).filter(function (entry) { return entry.type === 'file'; });
        const subscriptionFiles = (data[3] || []).filter(function (entry) { return entry.type === 'file'; });
        const subscriptions = uci.sections('momo', 'subscription');
        const currentProfile = uci.get('momo', 'config', 'profile') || '';
        const choices = [];
        const prependGroups = buildRuleGroups(parseRuleArray(uci.get('momo', 'mixin', 'route_rules_prepend')));
        const appendGroups = buildRuleGroups(parseRuleArray(uci.get('momo', 'mixin', 'route_rules_append')));
        const expanded = {};
        const pendingFields = {};
        let selectedPath = '';
        let outbounds = [MANAGED_SELECTOR_TAG, MANAGED_URLTEST_TAG, 'DIRECT', 'REJECT'];

        for (const profile of profiles) {
            choices.push({ path: paths.profiles_dir + '/' + profile.name, label: '本地配置：' + profile.name, value: 'file:' + profile.name });
        }
        for (const subscription of subscriptions) {
            const file = momo.subscriptionOutputFile(subscription);
            const exists = subscriptionFiles.some(function (entry) { return entry.name === file; });
            choices.push({ path: paths.subscriptions_dir + '/' + file, label: '订阅配置：' + (subscription.name || file) + (exists ? '' : '（未生成）'), value: 'subscription:' + subscription['.name'] });
        }
        selectedPath = (choices.find(function (item) { return item.value === currentProfile; }) || choices[0] || {}).path || '';

        const targetSelect = E('select', {}, choices.map(function (item) {
            return E('option', { value: item.path, selected: item.path === selectedPath ? 'selected' : null }, item.label);
        }));
        const searchInput = E('input', { type: 'search', placeholder: '搜索出站、域名、关键词' });
        const statsNode = E('span', { class: 'momo-append-meta' }, '正在读取配置...');
        const prependNode = E('div', { class: 'momo-append-grid' });
        const appendNode = E('div', { class: 'momo-append-grid' });

        function updateOutbounds(path) {
            selectedPath = path;
            statsNode.textContent = '正在读取出站/节点组...';
            return L.resolveDefault(fs.read_direct(path), '').then(function (content) {
                const profile = momo.parseProfile(content);
                outbounds = profileOutbounds(profile);
                statsNode.textContent = '当前配置可读取出站/节点组 ' + outbounds.length + ' 个。默认“所有节点”会自动包含全部代理节点、直连和 urltest。';
                renderRules();
            }).catch(function (error) {
                statsNode.textContent = '读取配置失败，可手动输入出站名称';
                momo.notify('读取配置失败：' + String(error), 'warning');
                renderRules();
            });
        }

        function addRule(groups, position) {
            const outbound = MANAGED_SELECTOR_TAG;
            groups.push({ outbound: outbound, rule: { outbound: outbound }, count: 1 });
            const key = position + ':' + (groups.length - 1);
            expanded[key] = true;
            pendingFields[key] = { domain_suffix: true };
            renderRules();
        }

        function saveRules() {
            const prepend = flattenGroups(prependGroups);
            const append = flattenGroups(appendGroups);
            return momo.saveRouteAppend(JSON.stringify(prepend, null, 2), JSON.stringify(append, null, 2)).then(function () {
                momo.notify('规则附加已保存', 'info');
            });
        }

        function applyNow() {
            const prepend = flattenGroups(prependGroups);
            const append = flattenGroups(appendGroups);
            if (!selectedPath) {
                momo.notify('请选择要立即应用的配置', 'warning');
                return Promise.resolve();
            }
            return saveRules().then(function () {
                return L.resolveDefault(fs.read_direct(selectedPath), '');
            }).then(function (content) {
                const originalProfile = ensureManagedOutbounds(momo.parseProfile(content));
                const missing = missingRuleOutbounds(originalProfile, prepend.concat(append));
                if (missing.length) {
                    momo.notify('立即应用失败，未写入配置：出站/节点组不存在：' + missing.join(', '), 'danger');
                    return false;
                }
                const profile = mergeAppendRules(originalProfile, prepend, append);
                const updated = JSON.stringify(profile, null, 2) + '\n';
                const checkPath = selectedPath.replace(/\.(json|yaml|yml)$/i, '') + '.append-check.json';
                const cleanup = function () {
                    return L.resolveDefault(momo.removeFileQuiet(checkPath), null);
                };
                return momo.writefile(checkPath, updated).then(function () {
                    return momo.validateProfilePath(checkPath);
                }).then(function (result) {
                    if (!result?.success) {
                        return cleanup().then(function () {
                            momo.notify('立即应用失败，未写入配置：' + (result?.error || 'sing-box check 未通过'), 'danger');
                            return false;
                        });
                    }
                    return cleanup().then(function () {
                        return momo.writefile(selectedPath, updated);
                    }).then(function () {
                        momo.notify('规则附加已应用到所选配置', 'info');
                        return updateOutbounds(selectedPath);
                    });
                }).catch(function (error) {
                    return cleanup().then(function () {
                        throw error;
                    });
                });
            });
        }

        function renderList(node, groups, position) {
            node.replaceChildren();
            const query = String(searchInput.value || '').trim().toLowerCase();
            let visible = 0;
            groups.forEach(function (group, index) {
                const haystack = (group.outbound + ' ' + JSON.stringify(group.rule)).toLowerCase();
                if (query && haystack.indexOf(query) < 0) {
                    return;
                }
                visible++;
                const key = position + ':' + index;
                const pending = pendingFields[key] || (pendingFields[key] = {});
                node.appendChild(renderAppendCard(group, index, !!expanded[key], pending, function () {
                    expanded[key] = !expanded[key];
                    renderRules();
                }, function () {
                    if (!window.confirm('删除这条附加规则？')) {
                        return;
                    }
                    groups.splice(index, 1);
                    delete expanded[key];
                    delete pendingFields[key];
                    renderRules();
                }, renderRules));
            });
            if (!visible) {
                node.appendChild(E('div', { class: 'momo-empty-note' }, query ? '没有匹配的附加规则' : '暂无附加规则'));
            }
        }

        function renderRules() {
            renderList(prependNode, prependGroups, 'prepend');
            renderList(appendNode, appendGroups, 'append');
        }

        targetSelect.addEventListener('change', function () {
            updateOutbounds(targetSelect.value);
        });
        searchInput.addEventListener('input', renderRules);

        const page = E('div', {}, [
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '规则附加'),
                E('div', { class: 'momo-append-toolbar' }, [
                    targetSelect,
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-action', click: function () { return updateOutbounds(targetSelect.value); } }, '读取出站'),
                    searchInput,
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-positive', click: function () { addRule(prependGroups, 'prepend'); } }, '新增前置规则'),
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-positive', click: function () { addRule(appendGroups, 'append'); } }, '新增后置规则'),
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-save', click: saveRules }, '保存模板'),
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-apply', click: applyNow }, '保存并立即应用'),
                    statsNode
                ])
            ]),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '前置规则'),
                E('div', { class: 'momo-append-meta' }, '前置规则会放在订阅规则前面，适合强制指定某些网站走指定策略。'),
                prependNode
            ]),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '后置规则'),
                E('div', { class: 'momo-append-meta' }, '后置规则会放在订阅规则后面，适合作为兜底补充。'),
                appendNode
            ])
        ]);

        if (selectedPath) {
            window.setTimeout(function () { updateOutbounds(selectedPath); }, 0);
        } else {
            statsNode.textContent = '没有可读取的配置，可手动输入出站名称';
            renderRules();
        }

        return page;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
