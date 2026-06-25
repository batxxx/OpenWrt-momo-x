'use strict';
'require view';
'require fs';
'require ui';
'require tools.momo as momo';

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function highlightLine(line) {
    let html = escapeHtml(line);

    html = html.replace(/("(?:\\.|[^"\\])*")(?=\s*:)/g, '<span class="momo-token-key">$1</span>');
    html = html.replace(/(:\s*)("(?:\\.|[^"\\])*")/g, '$1<span class="momo-token-string">$2</span>');
    html = html.replace(/(\b(?:true|false|null)\b)/g, '<span class="momo-token-literal">$1</span>');
    html = html.replace(/(\b-?\d+(?:\.\d+)?\b)/g, '<span class="momo-token-number">$1</span>');
    html = html.replace(/^(\s*[-?]?\s*)([A-Za-z0-9_.-]+)(\s*:)/, '$1<span class="momo-token-key">$2</span>$3');
    html = html.replace(/(#.*)$/g, '<span class="momo-token-comment">$1</span>');

    return html || '&nbsp;';
}

function filename(path) {
    return String(path || '').split('/').pop() || path;
}

function installStyle() {
    if (document.getElementById('momo-code-editor-style')) {
        return;
    }

    document.head.appendChild(E('style', { id: 'momo-code-editor-style' }, `
.momo-editor-page {
    min-height: calc(100vh - 160px);
}
.tabs a[href*="/admin/services/momo/profile/editor"],
.cbi-tabmenu a[href*="/admin/services/momo/profile/editor"],
.tabs a[href$="/profile/editor"],
.cbi-tabmenu a[href$="/profile/editor"] {
    display: none !important;
}
.momo-editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}
.momo-editor-title {
    min-width: 0;
}
.momo-editor-title h2 {
    margin: 0;
}
.momo-editor-title code {
    display: block;
    margin-top: 6px;
    color: #7c8aa5;
    font-size: 12px;
    overflow-wrap: anywhere;
}
.momo-editor-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
}
.momo-editor-shell {
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr);
    height: calc(100vh - 260px);
    min-height: 520px;
    border: 1px solid #263640;
    border-radius: 8px;
    overflow: hidden;
    background: #223036;
    box-shadow: 0 12px 32px rgba(0,0,0,.14);
}
.momo-editor-lines {
    overflow: hidden;
    padding: 12px 10px;
    background: #162329;
    color: #6f8792;
    font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    text-align: right;
    user-select: none;
    white-space: pre;
}
.momo-editor-code {
    position: relative;
    min-width: 0;
    overflow: hidden;
}
.momo-editor-highlight,
.momo-editor-input {
    box-sizing: border-box;
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 12px 16px;
    border: 0;
    outline: 0;
    font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    tab-size: 2;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
}
.momo-editor-highlight {
    overflow: hidden;
    color: #dbe7ea;
    pointer-events: none;
}
.momo-editor-input {
    z-index: 1;
    width: 100%;
    height: 100%;
    resize: none;
    color: transparent;
    caret-color: #fff;
    background: transparent;
    -webkit-text-fill-color: transparent;
}
.momo-editor-input::selection {
    background: rgba(91, 141, 239, .35);
}
.momo-token-key {
    color: #ff8b66;
    font-weight: 600;
}
.momo-token-string {
    color: #dbe7ea;
}
.momo-token-number {
    color: #ff4269;
}
.momo-token-literal {
    color: #c284ff;
}
.momo-token-comment {
    color: #708995;
}
@media (max-width: 720px) {
    .momo-editor-header {
        align-items: stretch;
        flex-direction: column;
    }
    .momo-editor-actions {
        justify-content: flex-start;
    }
    .momo-editor-shell {
        grid-template-columns: 46px minmax(0, 1fr);
        height: calc(100vh - 300px);
        min-height: 420px;
    }
    .momo-editor-lines,
    .momo-editor-highlight,
    .momo-editor-input {
        font-size: 12px;
        line-height: 1.6;
    }
    .momo-editor-highlight,
    .momo-editor-input {
        padding: 10px;
    }
}
`));
}

function renderEditor(path, content, readonly) {
    const lineGutter = E('pre', { class: 'momo-editor-lines' });
    const highlight = E('pre', { class: 'momo-editor-highlight' });
    const textarea = E('textarea', {
        class: 'momo-editor-input' + (readonly ? ' is-readonly' : ''),
        spellcheck: 'false',
        readonly: readonly ? 'readonly' : null,
        wrap: 'soft'
    }, content || '');

    function sync() {
        const value = textarea.value || '';
        const lines = value.split('\n');
        lineGutter.textContent = lines.map(function (_, index) {
            return index + 1;
        }).join('\n');
        highlight.innerHTML = lines.map(highlightLine).join('\n');
        lineGutter.scrollTop = textarea.scrollTop;
        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
    }

    textarea.addEventListener('input', sync);
    textarea.addEventListener('scroll', sync);
    textarea.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Tab') {
            return;
        }
        ev.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.setRangeText('  ', start, end, 'end');
        sync();
    });

    window.requestAnimationFrame(sync);

    return {
        node: E('div', { class: 'momo-editor-shell' }, [
            lineGutter,
            E('div', { class: 'momo-editor-code' }, [
                highlight,
                textarea
            ])
        ]),
        value: function () {
            return textarea.value;
        },
        setValue: function (value) {
            textarea.value = value;
            sync();
        }
    };
}

function formatEditor(editor) {
    try {
        editor.setValue(JSON.stringify(JSON.parse(editor.value()), null, 2) + '\n');
        momo.notify('配置已格式化', 'info');
    } catch (e) {
        momo.notify('当前内容不是有效 JSON，无法格式化。', 'danger');
    }
}

function saveFile(path, editor, restart) {
    if (editor.readonly) {
        momo.notify('运行配置是启动时生成的只读文件，不能直接保存。', 'warning');
        return Promise.resolve();
    }
    const content = editor.value();
    const shouldValidate = /\.json$/i.test(path);

    return Promise.resolve(shouldValidate ? momo.validateProfile(content) : { success: true }).then(function (result) {
        if (result && result.success === false) {
            momo.notify('配置校验失败，已取消保存：' + (result.error || '未知错误'), 'danger');
            return false;
        }
        return momo.writefile(path, content).then(function () {
            return true;
        });
    }).then(function (saved) {
        if (!saved) {
            return;
        }
        momo.notify(restart ? '配置已保存，正在重启服务' : '配置已保存', 'info');
        if (restart) {
            return momo.restart();
        }
    });
}

return view.extend({
    load: function () {
        const query = new URLSearchParams(window.location.search);
        const path = query.get('file') || '';
        const readonly = query.get('readonly') === '1';

        if (!path) {
            return Promise.resolve(['', '', false]);
        }

        return L.resolveDefault(fs.read_direct(path), '').then(function (content) {
            return [path, content, readonly];
        });
    },

    render: function (data) {
        installStyle();

        const path = data[0];
        const content = data[1];
        const readonly = data[2];

        if (!path) {
            return E('div', { class: 'cbi-section' }, [
                E('h3', {}, '文件编辑'),
                E('p', {}, '请从“配置文件”页面选择一个配置文件进行编辑。'),
                E('button', { type: 'button',
                    class: 'btn cbi-button cbi-button-action',
                    click: function () {
                        window.location.href = L.url('admin/services/momo/profile');
                    }
                }, '返回配置文件')
            ]);
        }

        const editor = renderEditor(path, content, readonly);
        editor.readonly = readonly;

        const actions = [
            E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-neutral',
                click: function () {
                    window.location.href = L.url('admin/services/momo/profile');
                }
            }, '返回')
        ];

        if (!readonly) {
            actions.push(E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-action',
                click: function () {
                    return formatEditor(editor);
                }
            }, '格式化'));
            actions.push(E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-save',
                click: function () {
                    return saveFile(path, editor, false);
                }
            }, '保存'));
            actions.push(E('button', { type: 'button',
                class: 'btn cbi-button cbi-button-apply',
                click: function () {
                    return saveFile(path, editor, true);
                }
            }, '保存并重启'));
        }

        return E('div', { class: 'momo-editor-page' }, [
            E('div', { class: 'cbi-section momo-editor-header' }, [
                E('div', { class: 'momo-editor-title' }, [
                    E('h2', {}, (readonly ? '文件查看：' : '文件编辑：') + filename(path)),
                    E('code', {}, path)
                ]),
                E('div', { class: 'momo-editor-actions' }, actions)
            ]),
            editor.node
        ]);
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
