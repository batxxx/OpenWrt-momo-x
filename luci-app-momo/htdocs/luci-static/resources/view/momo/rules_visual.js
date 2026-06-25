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
    ['rule_set', '规则集'],
    ['process_name', '进程名'],
    ['package_name', '包名'],
    ['protocol', '协议'],
    ['port', '端口']
];

const DOMAIN_ROUTE_FIELDS = ['domain', 'domain_suffix', 'domain_keyword', 'domain_regex', 'ip_cidr', 'rule_set'];
const ADVANCED_ROUTE_FIELDS = ['process_name', 'package_name', 'protocol', 'port'];
const INTERNAL_RULE_KEYS = ['_momo_remove'];

function installStyle() {
    if (document.getElementById('momo-rules-visual-style')) {
        return;
    }

    document.head.appendChild(E('style', { id: 'momo-rules-visual-style' }, `
.momo-rules-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.momo-rules-toolbar select,
.momo-rules-toolbar input[type="search"] {
    min-width: 260px;
}
.momo-rules-grid {
    display: grid;
    gap: 8px;
}
.momo-rule-card,
.momo-group-card {
    border: 1px solid var(--border-color-medium, #dde3ea);
    border-radius: 8px;
    background: var(--background-color-high, #fff);
    overflow: hidden;
}
.momo-rule-summary,
.momo-group-summary {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    cursor: pointer;
}
.momo-rule-summary:hover,
.momo-group-summary:hover {
    background: rgba(91, 141, 239, .06);
}
.momo-rule-title {
    font-weight: 700;
    overflow-wrap: anywhere;
}
.momo-rule-meta {
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
.momo-rule-detail,
.momo-group-detail {
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
.momo-detail-actions select {
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
.momo-member-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.momo-member-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 260px;
    padding: 6px 8px 6px 10px;
    border: 1px solid #dbe3ef;
    border-radius: 8px;
    background: #f8fbff;
}
.momo-member-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.momo-member-remove {
    min-width: auto;
    padding: 2px 7px;
}
.momo-empty-note {
    padding: 18px 10px;
    color: #7c8aa5;
}
@media (max-width: 760px) {
    .momo-rule-summary,
    .momo-group-summary {
        grid-template-columns: 1fr;
    }
    .momo-chip-row {
        justify-content: flex-start;
    }
}
`));
}

function safeConfigName(name) {
    name = String(name || '').trim()
        .replace(/[\/\\:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .replace(/^_+|_+$/g, '');

    if (!name) {
        return '';
    }

    if (!/\.(json|yaml|yml)$/i.test(name)) {
        name += '.json';
    }

    return name;
}

function subscriptionOutputFile(section) {
    return section.output_file || safeConfigName(section.name || section['.name']) || (section['.name'] + '.json');
}

function asArray(value) {
    if (value == null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function linesToArray(value) {
    return String(value || '')
        .split('\n')
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.length > 0; });
}

function setRuleField(rule, field, value) {
    const items = linesToArray(value);
    if (items.length) {
        rule[field] = items;
    } else {
        delete rule[field];
    }
}

function uniqueItems(items) {
    const seen = {};
    const result = [];
    for (const item of items) {
        const value = String(item || '').trim();
        if (!value || seen[value]) {
            continue;
        }
        seen[value] = true;
        result.push(value);
    }
    return result;
}

function cleanRuleForSave(rule) {
    const copy = {};
    for (const key in rule) {
        if (INTERNAL_RULE_KEYS.includes(key)) {
            continue;
        }
        copy[key] = rule[key];
    }
    return copy;
}

function isDomainRouteRule(rule) {
    if (!rule || rule._momo_remove || !rule.outbound || rule.action || rule.clash_mode || rule.type === 'logical') {
        return false;
    }

    const keys = Object.keys(rule).filter(function (key) {
        return !INTERNAL_RULE_KEYS.includes(key) && key !== 'outbound';
    });
    if (!keys.length) {
        return false;
    }

    return keys.every(function (key) {
        return DOMAIN_ROUTE_FIELDS.includes(key);
    });
}

function isAdvancedRouteRule(rule) {
    if (!rule || rule._momo_remove || !rule.outbound || rule.action || rule.clash_mode) {
        return false;
    }

    return ADVANCED_ROUTE_FIELDS.some(function (key) {
        return asArray(rule[key]).length > 0;
    }) || rule.type === 'logical';
}

function mergeDomainRules(entries) {
    const merged = { outbound: entries[0]?.rule?.outbound || '' };
    for (const field of DOMAIN_ROUTE_FIELDS) {
        const values = [];
        for (const entry of entries) {
            values.push.apply(values, asArray(entry.rule[field]));
        }
        const unique = uniqueItems(values);
        if (unique.length) {
            merged[field] = unique;
        }
    }
    return merged;
}

function applyDomainGroup(entries, merged) {
    if (!entries.length) {
        return;
    }

    const first = entries[0].rule;
    first.outbound = merged.outbound;
    for (const field of DOMAIN_ROUTE_FIELDS) {
        if (asArray(merged[field]).length) {
            first[field] = uniqueItems(asArray(merged[field]));
        } else {
            delete first[field];
        }
    }

    for (let i = 1; i < entries.length; i++) {
        entries[i].rule._momo_remove = true;
    }
}

function buildRuleViews(rules) {
    const domainMap = {};
    const domainViews = [];
    const advancedViews = [];
    const systemViews = [];

    rules.forEach(function (rule, index) {
        if (!rule || rule._momo_remove) {
            return;
        }

        if (isDomainRouteRule(rule)) {
            const key = 'domain:' + rule.outbound;
            if (!domainMap[key]) {
                domainMap[key] = { key: key, title: rule.outbound, entries: [] };
                domainViews.push(domainMap[key]);
            }
            domainMap[key].entries.push({ rule: rule, index: index });
        } else if (isAdvancedRouteRule(rule)) {
            advancedViews.push({ key: 'advanced:' + index, rule: rule, index: index });
        } else {
            systemViews.push({ key: 'system:' + index, rule: rule, index: index });
        }
    });

    return {
        domains: domainViews,
        advanced: advancedViews,
        system: systemViews
    };
}

function ruleName(rule, index) {
    if (rule.outbound) {
        return rule.outbound;
    }
    if (rule.action) {
        return rule.action;
    }
    if (rule.clash_mode) {
        return 'Clash Mode: ' + rule.clash_mode;
    }
    return '规则 ' + (index + 1);
}

function populatedFields(rule) {
    return RULE_FIELDS.filter(function ([key]) {
        return asArray(rule[key]).length > 0;
    });
}

function ruleSummary(rule) {
    const parts = populatedFields(rule).map(function ([key, label]) {
        return label + ' ' + asArray(rule[key]).length;
    });
    if (rule.clash_mode) {
        parts.push('模式 ' + rule.clash_mode);
    }
    if (rule.action) {
        parts.push('动作 ' + rule.action);
    }
    return parts.length ? parts.join(' / ') : '动作规则';
}

function fieldPreview(rule) {
    const chips = [];
    for (const [key, label] of RULE_FIELDS) {
        const values = asArray(rule[key]);
        if (!values.length) {
            continue;
        }
        const sample = values.slice(0, 2).join(', ');
        chips.push(E('span', { class: 'momo-chip' }, label + ': ' + sample + (values.length > 2 ? ' +' + (values.length - 2) : '')));
    }
    if (!chips.length) {
        chips.push(E('span', { class: 'momo-chip momo-chip-muted' }, rule.action ? ('动作: ' + rule.action) : '无匹配条件'));
    }
    return chips;
}

function makeOptionSelect(values, selected) {
    const select = E('select', {}, values.map(function (value) {
        return E('option', { value: value, selected: value === selected ? 'selected' : null }, value);
    }));
    if (selected && !values.includes(selected)) {
        select.insertBefore(E('option', { value: selected, selected: 'selected' }, selected), select.firstChild);
    }
    return select;
}

function renderRuleField(rule, key, label, pendingFields, rerender) {
    const textarea = E('textarea', {}, asArray(rule[key]).join('\n'));
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
                    delete pendingFields[key];
                    rerender();
                }
            }, '移除')
        ]),
        textarea
    ]);
}

function renderRuleCard(rule, index, outboundTags, expanded, pendingFields, onToggle, onDelete, onSave, onSaveRestart, rerender) {
    const editableOutbound = !!rule.outbound && !rule.action && !rule.clash_mode;
    const outboundSelect = makeOptionSelect(outboundTags, rule.outbound || '');
    outboundSelect.addEventListener('change', function () {
        if (outboundSelect.value) {
            rule.outbound = outboundSelect.value;
            delete rule.action;
            rerender();
        }
    });

    const addFieldSelect = E('select', {}, [
        E('option', { value: '' }, '添加输入栏')
    ].concat(RULE_FIELDS.filter(function ([key]) {
        return asArray(rule[key]).length === 0 && !pendingFields[key];
    }).map(function ([key, label]) {
        return E('option', { value: key }, label);
    })));
    addFieldSelect.addEventListener('change', function () {
        if (!addFieldSelect.value) {
            return;
        }
        pendingFields[addFieldSelect.value] = true;
        rerender();
    });

    const fields = RULE_FIELDS.filter(function ([key]) {
        return asArray(rule[key]).length > 0 || pendingFields[key];
    }).map(function ([key, label]) {
        return renderRuleField(rule, key, label, pendingFields, rerender);
    });

    const actions = [];
    if (editableOutbound) {
        actions.push(E('label', {}, '使用出站/节点组'));
        actions.push(outboundSelect);
        actions.push(E('label', {}, '添加输入栏'));
        actions.push(addFieldSelect);
    }
    actions.push(E('button', { type: 'button',
        class: 'btn cbi-button cbi-button-save',
        click: function (ev) {
            ev.stopPropagation();
            return onSave();
        }
    }, '保存当前修改'));
    actions.push(E('button', { type: 'button',
        class: 'btn cbi-button cbi-button-apply',
        click: function (ev) {
            ev.stopPropagation();
            return onSaveRestart();
        }
    }, '保存并重启'));
    actions.push(E('button', { type: 'button',
        class: 'btn cbi-button cbi-button-negative',
        click: function (ev) {
            ev.stopPropagation();
            onDelete();
        }
    }, '删除规则'));

    const detail = expanded ? E('div', { class: 'momo-rule-detail' }, [
        E('div', { class: 'momo-detail-actions' }, actions),
        fields.length ? E('div', { class: 'momo-rule-fields' }, fields) : E('div', { class: 'momo-empty-note' }, editableOutbound ? '这条规则没有可视化匹配条件，可以添加输入栏。' : '这条系统规则没有可视化匹配字段。')
    ]) : null;

    const children = [
        E('div', {
            class: 'momo-rule-summary',
            click: function () { onToggle(); }
        }, [
            E('div', {}, [
                E('div', { class: 'momo-rule-title' }, ruleName(rule, index)),
                E('div', { class: 'momo-rule-meta' }, '#' + (index + 1) + ' · ' + ruleSummary(rule))
            ]),
            E('div', { class: 'momo-chip-row' }, fieldPreview(rule)),
            E('span', { class: 'momo-chip momo-chip-muted' }, expanded ? '收起' : '展开')
        ])
    ];
    if (detail) {
        children.push(detail);
    }

    return E('div', { class: 'momo-rule-card' + (expanded ? ' is-expanded' : ''), 'data-index': index }, children);
}

function renderDomainGroupCard(view, outboundTags, expanded, pendingFields, onToggle, onDelete, onSave, onSaveRestart, rerender) {
    const merged = mergeDomainRules(view.entries);
    const outboundSelect = makeOptionSelect(outboundTags, merged.outbound || '');
    outboundSelect.addEventListener('change', function () {
        if (outboundSelect.value) {
            merged.outbound = outboundSelect.value;
            applyDomainGroup(view.entries, merged);
            rerender();
        }
    });

    const addFieldSelect = E('select', {}, [
        E('option', { value: '' }, '添加输入栏')
    ].concat(RULE_FIELDS.filter(function ([key]) {
        return DOMAIN_ROUTE_FIELDS.includes(key) && asArray(merged[key]).length === 0 && !pendingFields[key];
    }).map(function ([key, label]) {
        return E('option', { value: key }, label);
    })));
    addFieldSelect.addEventListener('change', function () {
        if (!addFieldSelect.value) {
            return;
        }
        pendingFields[addFieldSelect.value] = true;
        rerender();
    });

    function renderMergedField(key, label) {
        const textarea = E('textarea', {}, asArray(merged[key]).join('\n'));
        textarea.addEventListener('input', function () {
            setRuleField(merged, key, textarea.value);
            applyDomainGroup(view.entries, merged);
        });

        return E('div', { class: 'momo-field' }, [
            E('label', {}, [
                E('span', {}, label),
                E('button', { type: 'button',
                    class: 'btn cbi-button cbi-button-remove momo-field-remove',
                    click: function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        delete merged[key];
                        delete pendingFields[key];
                        applyDomainGroup(view.entries, merged);
                        rerender();
                    }
                }, '移除')
            ]),
            textarea
        ]);
    }

    const fields = RULE_FIELDS.filter(function ([key]) {
        return DOMAIN_ROUTE_FIELDS.includes(key) && (asArray(merged[key]).length > 0 || pendingFields[key]);
    }).map(function ([key, label]) {
        return renderMergedField(key, label);
    });

    const detail = expanded ? E('div', { class: 'momo-rule-detail' }, [
        E('div', { class: 'momo-detail-actions' }, [
            E('label', {}, '使用出站/节点组'),
            outboundSelect,
            E('label', {}, '添加输入栏'),
            addFieldSelect,
            E('span', { class: 'momo-rule-meta' }, view.entries.length > 1 ? ('已聚合 ' + view.entries.length + ' 条同组规则，编辑后保存为一条规则') : '单条分流规则'),
            E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-save',
                click: function (ev) {
                    ev.stopPropagation();
                    return onSave();
                }
            }, '保存当前修改'),
            E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-apply',
                click: function (ev) {
                    ev.stopPropagation();
                    return onSaveRestart();
                }
            }, '保存并重启'),
            E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-negative',
                click: function (ev) {
                    ev.stopPropagation();
                    onDelete();
                }
            }, '删除此组')
        ]),
        fields.length ? E('div', { class: 'momo-rule-fields' }, fields) : E('div', { class: 'momo-empty-note' }, '这个分流组没有可视化匹配条件，可以添加输入栏。')
    ]) : null;

    const children = [
        E('div', {
            class: 'momo-rule-summary',
            click: function () { onToggle(); }
        }, [
            E('div', {}, [
                E('div', { class: 'momo-rule-title' }, view.title),
                E('div', { class: 'momo-rule-meta' }, '域名/IP 分流 · ' + ruleSummary(merged) + (view.entries.length > 1 ? (' · 聚合 ' + view.entries.length + ' 条') : ''))
            ]),
            E('div', { class: 'momo-chip-row' }, fieldPreview(merged)),
            E('span', { class: 'momo-chip momo-chip-muted' }, expanded ? '收起' : '展开')
        ])
    ];
    if (detail) {
        children.push(detail);
    }

    return E('div', { class: 'momo-rule-card' + (expanded ? ' is-expanded' : ''), 'data-key': view.key }, children);
}

function renderGroupCard(group, outboundTags, expanded, onToggle, onSave, onSaveRestart, rerender) {
    const typeSelect = makeOptionSelect(['selector', 'urltest'], group.type || 'selector');
    typeSelect.addEventListener('change', function () {
        group.type = typeSelect.value;
        rerender();
    });

    const availableMembers = outboundTags.filter(function (tag) {
        return tag !== group.tag && !asArray(group.outbounds).includes(tag);
    });
    const addMemberSelect = E('select', {}, [
        E('option', { value: '' }, '加入节点/节点组')
    ].concat(availableMembers.map(function (tag) {
        return E('option', { value: tag }, tag);
    })));
    addMemberSelect.addEventListener('change', function () {
        if (!addMemberSelect.value) {
            return;
        }
        group.outbounds = uniqueItems(asArray(group.outbounds).concat(addMemberSelect.value));
        rerender();
    });
    const memberList = E('div', { class: 'momo-member-list' }, asArray(group.outbounds).map(function (tag) {
        return E('span', { class: 'momo-member-pill' }, [
            E('span', { class: 'momo-member-name', title: tag }, tag),
            E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-remove momo-member-remove',
                click: function (ev) {
                    ev.stopPropagation();
                    group.outbounds = asArray(group.outbounds).filter(function (item) {
                        return item !== tag;
                    });
                    rerender();
                }
            }, '移除')
        ]);
    }));

    const children = [
        E('div', { class: 'momo-group-summary', click: onToggle }, [
            E('div', {}, [
                E('div', { class: 'momo-rule-title' }, group.tag || '(未命名组)'),
                E('div', { class: 'momo-rule-meta' }, (group.type || 'selector') + ' · 成员 ' + asArray(group.outbounds).length)
            ]),
            E('div', { class: 'momo-chip-row' }, asArray(group.outbounds).slice(0, 4).map(function (tag) {
                return E('span', { class: 'momo-chip' }, tag);
            }).concat(asArray(group.outbounds).length > 4 ? [E('span', { class: 'momo-chip momo-chip-muted' }, '+' + (asArray(group.outbounds).length - 4))] : [])),
            E('span', { class: 'momo-chip momo-chip-muted' }, expanded ? '收起' : '展开')
        ])
    ];
    if (expanded) {
        children.push(E('div', { class: 'momo-group-detail' }, [
            E('div', { class: 'momo-detail-actions' }, [
                E('label', {}, '组类型'),
                typeSelect,
                E('label', {}, '加入成员'),
                addMemberSelect,
                E('button', { type: 'button',
                    class: 'btn cbi-button cbi-button-save',
                    click: function (ev) {
                        ev.stopPropagation();
                        return onSave();
                    }
                }, '保存当前修改'),
                E('button', { type: 'button',
                    class: 'btn cbi-button cbi-button-apply',
                    click: function (ev) {
                        ev.stopPropagation();
                        return onSaveRestart();
                    }
                }, '保存并重启')
            ]),
            E('div', { class: 'momo-field' }, [
                E('label', {}, '包含的节点/节点组'),
                asArray(group.outbounds).length ? memberList : E('div', { class: 'momo-empty-note' }, '这个节点组还没有成员，可以从上方下拉加入。')
            ])
        ]));
    }

    return E('div', { class: 'momo-group-card' + (expanded ? ' is-expanded' : '') }, children);
}

function parseProfile(content) {
    const profile = JSON.parse(content || '{}');
    if (!profile.route || typeof profile.route !== 'object' || Array.isArray(profile.route)) {
        profile.route = {};
    }
    if (!Array.isArray(profile.route.rules)) {
        profile.route.rules = [];
    }
    if (!Array.isArray(profile.outbounds)) {
        profile.outbounds = [];
    }
    return profile;
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

        for (const profile of profiles) {
            choices.push({ path: paths.profiles_dir + '/' + profile.name, label: '本地配置：' + profile.name, value: 'file:' + profile.name });
        }
        for (const subscription of subscriptions) {
            const file = subscriptionOutputFile(subscription);
            const exists = subscriptionFiles.some(function (entry) { return entry.name === file; });
            choices.push({ path: paths.subscriptions_dir + '/' + file, label: '订阅配置：' + (subscription.name || file) + (exists ? '' : '（未生成）'), value: 'subscription:' + subscription['.name'] });
        }

        let selectedPath = (choices.find(function (item) { return item.value === currentProfile; }) || choices[0] || {}).path || '';
        let profile = null;
        let rawContent = '';
        const expandedRules = {};
        const expandedGroups = {};
        const pendingRuleFields = {};

        const fileSelect = E('select', {}, choices.map(function (item) {
            return E('option', { value: item.path, selected: item.path === selectedPath ? 'selected' : null }, item.label);
        }));
        const searchInput = E('input', { type: 'search', placeholder: '搜索规则名称、域名、节点组' });
        const domainRulesNode = E('div', { class: 'momo-rules-grid' });
        const advancedRulesNode = E('div', { class: 'momo-rules-grid' });
        const systemRulesNode = E('div', { class: 'momo-rules-grid' });
        const groupsNode = E('div', { class: 'momo-rules-grid' });
        const statsNode = E('span', { class: 'momo-rule-meta' }, '请选择配置文件');

        function outboundTags() {
            const tags = [];
            for (const outbound of profile?.outbounds || []) {
                if (outbound?.tag && !tags.includes(outbound.tag)) {
                    tags.push(outbound.tag);
                }
            }
            return tags;
        }

        function renderRules() {
            domainRulesNode.replaceChildren();
            advancedRulesNode.replaceChildren();
            systemRulesNode.replaceChildren();
            groupsNode.replaceChildren();

            if (!profile) {
                domainRulesNode.appendChild(E('div', { class: 'momo-empty-note' }, '请选择配置文件'));
                return;
            }

            const query = String(searchInput.value || '').trim().toLowerCase();
            const tags = outboundTags();
            const rules = profile.route.rules || [];
            const groups = (profile.outbounds || []).filter(function (outbound) {
                return outbound && Array.isArray(outbound.outbounds) && (outbound.type === 'selector' || outbound.type === 'urltest');
            });
            const views = buildRuleViews(rules);

            statsNode.textContent = '域名/IP 分流 ' + views.domains.length + ' 组，高级匹配 ' + views.advanced.length + ' 条，系统动作 ' + views.system.length + ' 条，出站/节点组 ' + tags.length + ' 个';

            let visibleDomains = 0;
            views.domains.forEach(function (view) {
                const haystack = (view.title + ' ' + JSON.stringify(mergeDomainRules(view.entries))).toLowerCase();
                if (query && haystack.indexOf(query) < 0) {
                    return;
                }
                visibleDomains++;
                const pendingFields = pendingRuleFields[view.key] || (pendingRuleFields[view.key] = {});
                domainRulesNode.appendChild(renderDomainGroupCard(view, tags, !!expandedRules[view.key], pendingFields, function () {
                    expandedRules[view.key] = !expandedRules[view.key];
                    renderRules();
                }, function () {
                    if (!window.confirm('删除分流组 “' + view.title + '”？')) {
                        return;
                    }
                    view.entries.forEach(function (entry) {
                        entry.rule._momo_remove = true;
                    });
                    delete expandedRules[view.key];
                    delete pendingRuleFields[view.key];
                    renderRules();
                }, function () {
                    return saveSelected(false);
                }, function () {
                    return saveSelected(true);
                }, renderRules));
            });
            if (!visibleDomains) {
                domainRulesNode.appendChild(E('div', { class: 'momo-empty-note' }, query ? '没有匹配的域名/IP 分流规则' : '没有域名/IP 分流规则'));
            }

            function renderSingleRuleList(node, items, emptyText) {
                let visible = 0;
                items.forEach(function (item) {
                    const haystack = JSON.stringify(item.rule).toLowerCase();
                    if (query && haystack.indexOf(query) < 0) {
                        return;
                    }
                    visible++;
                    const pendingFields = pendingRuleFields[item.key] || (pendingRuleFields[item.key] = {});
                    node.appendChild(renderRuleCard(item.rule, item.index, tags, !!expandedRules[item.key], pendingFields, function () {
                        expandedRules[item.key] = !expandedRules[item.key];
                        renderRules();
                    }, function () {
                        if (!window.confirm('删除规则 #' + (item.index + 1) + '？')) {
                            return;
                        }
                        item.rule._momo_remove = true;
                        delete expandedRules[item.key];
                        delete pendingRuleFields[item.key];
                        renderRules();
                    }, function () {
                        return saveSelected(false);
                    }, function () {
                        return saveSelected(true);
                    }, renderRules));
                });
                if (!visible) {
                    node.appendChild(E('div', { class: 'momo-empty-note' }, query ? '没有匹配的规则' : emptyText));
                }
            }
            renderSingleRuleList(advancedRulesNode, views.advanced, '没有高级匹配规则');
            renderSingleRuleList(systemRulesNode, views.system, '没有系统/动作规则');

            let visibleGroups = 0;
            groups.forEach(function (group) {
                const haystack = JSON.stringify(group).toLowerCase();
                if (query && haystack.indexOf(query) < 0) {
                    return;
                }
                visibleGroups++;
                const key = group.tag || String(visibleGroups);
                groupsNode.appendChild(renderGroupCard(group, tags, !!expandedGroups[key], function () {
                    expandedGroups[key] = !expandedGroups[key];
                    renderRules();
                }, function () {
                    return saveSelected(false);
                }, function () {
                    return saveSelected(true);
                }, renderRules));
            });
            if (!visibleGroups) {
                groupsNode.appendChild(E('div', { class: 'momo-empty-note' }, query ? '没有匹配的节点组' : '没有可编辑的节点组'));
            }
        }

        function loadSelected(path) {
            selectedPath = path;
            statsNode.textContent = '正在加载...';
            domainRulesNode.replaceChildren(E('div', { class: 'momo-empty-note' }, '正在加载配置文件...'));
            advancedRulesNode.replaceChildren();
            systemRulesNode.replaceChildren();
            groupsNode.replaceChildren();

            return L.resolveDefault(fs.read_direct(path), '').then(function (content) {
                rawContent = content;
                profile = parseProfile(content);
                for (const key in expandedRules) {
                    delete expandedRules[key];
                }
                for (const key in expandedGroups) {
                    delete expandedGroups[key];
                }
                for (const key in pendingRuleFields) {
                    delete pendingRuleFields[key];
                }
                renderRules();
            }).catch(function (error) {
                profile = null;
                momo.notify('读取配置失败：' + String(error), 'danger');
                renderRules();
            });
        }

        function saveSelected(restart) {
            if (!selectedPath || !profile) {
                momo.notify('请先选择配置文件', 'warning');
                return Promise.resolve();
            }
            profile.route.rules = (profile.route.rules || [])
                .filter(function (rule) { return rule && !rule._momo_remove; })
                .map(cleanRuleForSave);
            const content = JSON.stringify(profile, null, 2) + '\n';
            const checkPath = selectedPath.replace(/\.(json|yaml|yml)$/i, '') + '.check.json';
            let validationResult = null;

            function cleanupCheckFile() {
                return L.resolveDefault(momo.removeFileQuiet(checkPath), null);
            }

            return momo.writefile(checkPath, content).then(function () {
                return momo.validateProfilePath(checkPath);
            }).then(function (result) {
                validationResult = result;
                return cleanupCheckFile();
            }).then(function () {
                const result = validationResult;
                if (!result?.success) {
                    momo.notify('配置校验失败，未保存：' + (result?.error || 'sing-box check 未通过'), 'danger');
                    return false;
                }
                return momo.writefile(selectedPath, content);
            }).catch(function (error) {
                return cleanupCheckFile().then(function () {
                    throw error;
                });
            }).then(function (saved) {
                if (saved === false) {
                    return;
                }
                momo.notify(restart ? '规则已保存，正在重启服务' : '规则已保存', 'info');
                rawContent = content;
                if (restart) {
                    return momo.restart();
                }
            });
        }

        function addRule() {
            if (!profile) {
                return;
            }
            const tags = outboundTags();
            profile.route.rules.push({
                domain_suffix: [],
                outbound: tags.includes('Proxies') ? 'Proxies' : (tags[0] || 'direct')
            });
            const key = 'domain:' + (tags.includes('Proxies') ? 'Proxies' : (tags[0] || 'direct'));
            expandedRules[key] = true;
            pendingRuleFields[key] = { domain_suffix: true };
            renderRules();
        }

        fileSelect.addEventListener('change', function () {
            loadSelected(fileSelect.value);
        });
        searchInput.addEventListener('input', renderRules);

        const page = E('div', {}, [
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '规则配置'),
                E('div', { class: 'momo-rules-toolbar' }, [
                    fileSelect,
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-action', click: function () { return loadSelected(fileSelect.value); } }, '加载'),
                    searchInput,
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-positive', click: addRule }, '新增规则'),
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-save', click: function () { return saveSelected(false); } }, '保存'),
                    E('button', { type: 'button', class: 'btn cbi-button cbi-button-apply', click: function () { return saveSelected(true); } }, '保存并重启'),
                    statsNode
                ])
            ]),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '域名/IP 分流规则'),
                domainRulesNode
            ]),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '高级匹配规则'),
                advancedRulesNode
            ]),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '系统/动作规则'),
                systemRulesNode
            ]),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, '代理/节点组'),
                groupsNode
            ])
        ]);

        if (selectedPath) {
            window.setTimeout(function () { loadSelected(selectedPath); }, 0);
        } else {
            renderRules();
        }

        return page;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
