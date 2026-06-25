'use strict';
'require form';
'require view';
'require uci';
'require fs';
'require poll';
'require tools.momo as momo';

function appendLog(element, current, update) {
    if (!update?.update) {
        return current;
    }
    const next = (update.len < current.len || current.len === 0)
        ? (update.log ?? '')
        : current.text + (update.log ?? '');
    element.setValue(next);
    return { text: next, len: update.len };
}

function stopButtonEvent(ev) {
    if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
    }
}

function addScheduleOptions(section) {
    let o;

    o = section.taboption('log_config', form.ListValue, 'scheduled_clear_mode', _('清理模式'));
    o.default = 'cycle';
    o.rmempty = false;
    o.depends('scheduled_clear', '1');
    o.value('appointment', _('预约'));
    o.value('cycle', _('循环'));

    o = section.taboption('log_config', form.ListValue, 'scheduled_clear_weekday', _('清理日期(每周)'));
    o.default = '*';
    o.rmempty = false;
    o.depends({ scheduled_clear: '1', scheduled_clear_mode: 'appointment' });
    o.value('*', _('每天'));
    o.value('1', _('每周一'));
    o.value('2', _('每周二'));
    o.value('3', _('每周三'));
    o.value('4', _('每周四'));
    o.value('5', _('每周五'));
    o.value('6', _('每周六'));
    o.value('0', _('每周日'));

    o = section.taboption('log_config', form.ListValue, 'scheduled_clear_time', _('清理时间(每天)'));
    o.default = '03:00';
    o.rmempty = false;
    o.depends({ scheduled_clear: '1', scheduled_clear_mode: 'appointment' });
    for (let hour = 0; hour < 24; hour++) {
        const value = String(hour).padStart(2, '0') + ':00';
        o.value(value, hour + ':00');
    }

    o = section.taboption('log_config', form.ListValue, 'scheduled_clear_interval', _('清理间隔(分钟)'));
    o.default = '5';
    o.rmempty = false;
    o.depends({ scheduled_clear: '1', scheduled_clear_mode: 'cycle' });
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
            momo.getPaths(),
            momo.log('app', 0),
            momo.log('core', 0)
        ]);
    },
    render: function (data) {
        const paths = data[1];
        const appLog = data[2]?.log ?? '';
        const coreLog = data[3]?.log ?? '';
        let appLogState = { text: appLog, len: data[2]?.len ?? 0 };
        let coreLogState = { text: coreLog, len: data[3]?.len ?? 0 };

        let m, s, o;

        m = new form.Map('momo');

        s = m.section(form.NamedSection, 'log', 'log', _('Log'));

        s.tab('log_config', _('Log Config'));
        
        o = s.taboption('log_config', form.Flag, 'clear_at_stop', _('Clear At Stop'));
        o.rmempty = false;
        
        o = s.taboption('log_config', form.Flag, 'scheduled_clear', _('Scheduled Clear'));
        o.rmempty = false;

        addScheduleOptions(s);

        o = s.taboption('log_config', form.Value, 'scheduled_clear_size_limit', _('Scheduled Clear Size Limit'));
        o.retain = true;
        o.rmempty = false;
        o.datatype = 'uinteger';
        o.depends('scheduled_clear', '1');

        o = s.taboption('log_config', form.ListValue, 'scheduled_clear_size_limit_unit', _('Scheduled Clear Size Limit Unit'));
        o.retain = true;
        o.rmempty = false;
        o.depends('scheduled_clear', '1');
        o.value('KB', 'KB');
        o.value('MB', 'MB');
        o.value('GB', 'GB');

        s.tab('app_log', _('App Log'));

        o = s.taboption('app_log', form.Button, 'clear_app_log');
        o.inputstyle = 'negative';
        o.inputtitle = _('Clear Log');
        o.onclick = function (ev, section_id) {
            stopButtonEvent(ev);
            m.lookupOption('_app_log', section_id)[0].getUIElement(section_id).setValue('');
            return momo.clearAppLog();
        };

        o = s.taboption('app_log', form.TextValue, '_app_log');
        o.rows = 25;
        o.wrap = false;
        o.load = function (section_id) {
            return appLog;
        };
        o.write = function (section_id, formvalue) {
            return true;
        };
        poll.add(L.bind(function () {
            const option = this;
            return L.resolveDefault(momo.log('app', appLogState.len)).then(function (update) {
                appLogState = appendLog(option.getUIElement('log'), appLogState, update);
            });
        }, o));

        o = s.taboption('app_log', form.Button, 'scroll_app_log_to_bottom');
        o.inputtitle = _('Scroll To Bottom');
        o.onclick = function (ev, section_id) {
            stopButtonEvent(ev);
            const element = m.lookupOption('_app_log', section_id)[0].getUIElement(section_id).node.firstChild;
            element.scrollTop = element.scrollHeight;
        };

        s.tab('core_log', _('Core Log'));

        o = s.taboption('core_log', form.Button, 'clear_core_log');
        o.inputstyle = 'negative';
        o.inputtitle = _('Clear Log');
        o.onclick = function (ev, section_id) {
            stopButtonEvent(ev);
            m.lookupOption('_core_log', section_id)[0].getUIElement(section_id).setValue('');
            return momo.clearCoreLog();
        };

        o = s.taboption('core_log', form.TextValue, '_core_log');
        o.rows = 25;
        o.wrap = false;
        o.load = function (section_id) {
            return coreLog;
        };
        o.write = function (section_id, formvalue) {
            return true;
        };
        poll.add(L.bind(function () {
            const option = this;
            return L.resolveDefault(momo.log('core', coreLogState.len)).then(function (update) {
                coreLogState = appendLog(option.getUIElement('log'), coreLogState, update);
            });
        }, o));

        o = s.taboption('core_log', form.Button, 'scroll_core_log_to_bottom');
        o.inputtitle = _('Scroll To Bottom');
        o.onclick = function (ev, section_id) {
            stopButtonEvent(ev);
            const element = m.lookupOption('_core_log', section_id)[0].getUIElement(section_id).node.firstChild;
            element.scrollTop = element.scrollHeight;
        };

        s.tab('debug_log', _('Debug Log'));

        o = s.taboption('debug_log', form.Button, '_generate_download_debug_log');
        o.inputstyle = 'negative';
        o.inputtitle = _('Generate & Download');
        o.onclick = function (ev) {
            stopButtonEvent(ev);
            return momo.debug().then(function () {
                fs.read_direct(paths.debug_log_path, 'blob').then(function (data) {
                    // create url
                    const url = window.URL.createObjectURL(data, { type: 'text/markdown' });
                    // create link
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'debug.log';
                    // append to body
                    document.body.appendChild(link);
                    // download
                    link.click();
                    // remove from body
                    document.body.removeChild(link);
                    // revoke url
                    window.URL.revokeObjectURL(url);
                });
            });
        };

        return m.render().then(function (node) {
            node.querySelectorAll('button').forEach(function (button) {
                button.setAttribute('type', 'button');
            });
            return node;
        });
    }
});
