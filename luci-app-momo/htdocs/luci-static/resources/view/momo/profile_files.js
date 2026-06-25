'use strict';
'require form';
'require view';
'require uci';
'require fs';
'require tools.momo as momo';

function formatTime(epoch) {
    if (!epoch) {
        return '-';
    }
    const date = new Date(epoch * 1000);
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0') + ' ' +
        String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0') + ':' +
        String(date.getSeconds()).padStart(2, '0');
}

function formatSize(size) {
    size = Number(size || 0);
    if (size >= 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(1) + ' MB';
    }
    if (size >= 1024) {
        return (size / 1024).toFixed(1) + ' KB';
    }
    return size + ' B';
}

function openEditor(path, readonly) {
    let url = L.url('admin/services/momo/profile/editor') + '?file=' + encodeURIComponent(path);
    if (readonly) {
        url += '&readonly=1';
    }
    window.location.href = url;
}

function downloadFile(path, name) {
    return L.resolveDefault(fs.read_direct(path, 'blob')).then(function (data) {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    });
}

function button(title, style, onclick) {
    return E('button', {
        type: 'button',
        'class': 'btn cbi-button cbi-button-' + (style || 'neutral'),
        'click': function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            return onclick(ev);
        }
    }, title);
}

function normalizeButtons(node) {
    node.querySelectorAll('button').forEach(function (button) {
        button.setAttribute('type', 'button');
    });
    return node;
}

function readTextFile(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
            resolve(reader.result || '');
        };
        reader.onerror = function () {
            reject(reader.error || new Error('读取文件失败'));
        };
        reader.readAsText(file);
    });
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

function renderUploadPanel(paths, refreshProfileList) {
    let input;

    const upload = function () {
        const file = input.files && input.files[0];
        if (!file) {
            momo.notify('请先选择配置文件', 'warning');
            return Promise.resolve();
        }

        if (!/\.(json|yaml|yml)$/i.test(file.name)) {
            momo.notify('仅支持 .json、.yaml、.yml 配置文件', 'danger');
            return Promise.resolve();
        }

        const name = safeConfigName(file.name);
        if (!name) {
            momo.notify('配置文件名无效', 'danger');
            return Promise.resolve();
        }

        return readTextFile(file).then(function (content) {
            return momo.writefile(paths.profiles_dir + '/' + name, content);
        }).then(function () {
            momo.notify('配置文件已上传：' + name, 'info');
            input.value = '';
            return refreshProfileList();
        }).catch(function (error) {
            momo.notify('配置文件上传失败：' + String(error), 'danger');
        });
    };

    input = E('input', {
        type: 'file',
        accept: '.json,.yaml,.yml,application/json,text/yaml,text/x-yaml',
        style: 'min-width:280px'
    });

    return E('div', { class: 'cbi-section' }, [
        E('h3', {}, '配置管理'),
        E('div', { class: 'cbi-value' }, [
            E('label', { class: 'cbi-value-title' }, '上传配置文件'),
            E('div', { class: 'cbi-value-field' }, [
                input,
                ' ',
                button('上传', 'positive', upload)
            ])
        ]),
        E('div', { class: 'cbi-value-description' }, '上传后的配置文件会显示在下方“配置文件列表”中。')
    ]);
}

function subscriptionOutputFile(section) {
    const explicit = section.output_file || '';
    if (explicit) {
        return explicit;
    }
    return safeConfigName(section.name || section['.name']) || (section['.name'] + '.json');
}

function renderStatus(active) {
    return E('strong', {
        'style': 'color:' + (active ? 'var(--success-color,#2e7d32)' : 'inherit')
    }, active ? '启用' : '-');
}

function buildRows(paths, profiles, subscriptionFiles, subscriptions) {
    const rows = [];
    const usedSubscriptionFiles = {};

    profiles = (profiles || []).filter(function (entry) { return entry.type === 'file'; });
    subscriptionFiles = (subscriptionFiles || []).filter(function (entry) { return entry.type === 'file'; });

    for (const profile of profiles) {
        rows.push({
            type: '本地配置',
            name: profile.name,
            path: paths.profiles_dir + '/' + profile.name,
            value: 'file:' + profile.name,
            info: '-',
            size: profile.size,
            mtime: profile.mtime,
            deletable: true
        });
    }

    for (const section of subscriptions) {
        const fileName = subscriptionOutputFile(section);
        const file = subscriptionFiles.find(function (entry) {
            return entry.name === fileName;
        });
        const section_id = section['.name'];
        usedSubscriptionFiles[fileName] = true;
        rows.push({
            type: '订阅生成',
            name: fileName,
            path: paths.subscriptions_dir + '/' + fileName,
            value: 'subscription:' + section_id,
            info: subscriptionInfo(subscriptions, section_id),
            size: file ? file.size : 0,
            mtime: file ? file.mtime : 0,
            deletable: !!file,
            missing: !file
        });
    }

    for (const file of subscriptionFiles) {
        if (usedSubscriptionFiles[file.name]) {
            continue;
        }
        rows.push({
            type: '订阅生成',
            name: file.name,
            path: paths.subscriptions_dir + '/' + file.name,
            value: '',
            info: '未关联订阅',
            size: file.size,
            mtime: file.mtime,
            deletable: true
        });
    }

    rows.push({
        type: '运行配置（只读）',
        name: 'config.json',
        path: paths.run_profile_path,
        value: '',
        info: '当前启动时生成的配置',
        size: 0,
        mtime: 0,
        deletable: false,
        readonly: true
    });

    return rows;
}

function subscriptionInfo(subscriptions, section_id) {
    const section = subscriptions.find(function (item) {
        return item['.name'] === section_id;
    }) || {};

    const parts = [];
    if (section.name) {
        parts.push(section.name);
    }
    if (section.used || section.total) {
        parts.push((section.used || '-') + ' / ' + (section.total || '-'));
    }
    if (section.expire) {
        parts.push('到期 ' + section.expire);
    }
    if (section.success === '0' && section.error) {
        parts.push('失败：' + section.error);
    }

    return parts.length ? parts.join('，') : '-';
}

function renderProfileTable(paths, rows, currentProfile, refreshProfileList) {
    const createProfile = function () {
        const input = window.prompt('请输入配置文件名，例如 home.json 或 home.yaml');
        const name = safeConfigName(input);
        if (!name) {
            return;
        }

        const path = paths.profiles_dir + '/' + name;
        const content = [
            '{',
            '  "log": {',
            '    "level": "info",',
            '    "timestamp": true',
            '  },',
            '  "outbounds": [',
            '    {',
            '      "type": "direct",',
            '      "tag": "direct"',
            '    }',
            '  ],',
            '  "route": {',
            '    "final": "direct"',
            '  }',
            '}',
            ''
        ].join('\n');

        return momo.writefile(path, content).then(function () {
            openEditor(path);
        });
    };

    const tableRows = [
        E('div', { 'class': 'tr table-titles' }, [
            E('div', { 'class': 'th' }, '状态'),
            E('div', { 'class': 'th' }, '类型'),
            E('div', { 'class': 'th' }, '配置文件名'),
            E('div', { 'class': 'th' }, '订阅信息'),
            E('div', { 'class': 'th' }, '更新时间'),
            E('div', { 'class': 'th' }, '文件大小'),
            E('div', { 'class': 'th' }, '操作')
        ])
    ];

    if (rows.length) {
        for (const row of rows) {
            const isActive = row.value && row.value === currentProfile;
            const actions = [];

            if (row.missing) {
                actions.push(E('span', { 'class': 'momo-muted' }, '请到订阅管理更新'));
            } else {
                actions.push(button(row.readonly ? '查看' : '编辑', 'action', function () {
                    openEditor(row.path, row.readonly);
                }));
                actions.push(' ');
                actions.push(button('下载', 'action', function () {
                    return downloadFile(row.path, row.name);
                }));
            }

            if (row.value && !row.missing) {
                actions.push(' ');
                actions.push(button('切换', 'positive', function () {
                    return momo.setProfile(row.value).then(refreshProfileList);
                }));
            }

            if (row.deletable) {
                actions.push(' ');
                actions.push(button('删除', 'negative', function () {
                    const message = isActive
                        ? '当前正在使用 ' + row.name + '，删除后需要重新选择或重新更新订阅。确定删除？'
                        : '删除配置文件 ' + row.name + '？';
                    if (!window.confirm(message)) {
                        return;
                    }
                    return momo.removeFile(row.path).then(refreshProfileList);
                }));
            }

            tableRows.push(E('div', { 'class': 'tr cbi-section-table-row' }, [
                E('div', { 'class': 'td' }, renderStatus(isActive)),
                E('div', { 'class': 'td' }, row.type),
                E('div', { 'class': 'td' }, row.name),
                E('div', { 'class': 'td' }, row.missing ? '配置文件尚未生成，请更新订阅' : row.info),
                E('div', { 'class': 'td' }, formatTime(row.mtime)),
                E('div', { 'class': 'td' }, row.size ? formatSize(row.size) : '-'),
                E('div', { 'class': 'td' }, actions)
            ]));
        }
    } else {
        tableRows.push(E('div', { 'class': 'tr placeholder' }, [
            E('div', { 'class': 'td', 'colspan': '7' }, '尚无配置文件')
        ]));
    }

    return E('div', { 'class': 'cbi-section' }, [
        E('h3', {}, '配置文件列表'),
        E('div', { 'class': 'cbi-section-node', 'style': 'margin-bottom:12px' }, [
            button('新增配置文件', 'positive', createProfile)
        ]),
        E('div', { 'class': 'table cbi-section-table' }, tableRows)
    ]);
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('momo'),
            momo.getPaths(),
            momo.listProfiles(),
            momo.listSubscriptionFiles(),
        ]);
    },
    render: function (data) {
        const paths = data[1];
        let table;
        const refreshProfileList = function () {
            return Promise.all([
                uci.load('momo'),
                momo.listProfiles(),
                momo.listSubscriptionFiles()
            ]).then(function (fresh) {
                const subscriptions = uci.sections('momo', 'subscription');
                const currentProfile = uci.get('momo', 'config', 'profile') || '';
                const rows = buildRows(paths, fresh[1], fresh[2], subscriptions);
                const nextTable = renderProfileTable(paths, rows, currentProfile, refreshProfileList);
                normalizeButtons(nextTable);
                if (table && table.parentNode) {
                    table.parentNode.replaceChild(nextTable, table);
                }
                table = nextTable;
            });
        };

        const subscriptions = uci.sections('momo', 'subscription');
        const currentProfile = uci.get('momo', 'config', 'profile') || '';
        const rows = buildRows(paths, data[2], data[3], subscriptions);
        table = renderProfileTable(paths, rows, currentProfile, refreshProfileList);

        return normalizeButtons(E('div', {}, [
            renderUploadPanel(paths, refreshProfileList),
            table
        ]));
    }
});
