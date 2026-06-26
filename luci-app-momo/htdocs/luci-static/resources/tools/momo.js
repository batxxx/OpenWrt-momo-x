'use strict';
'require baseclass';
'require uci';
'require fs';
'require rpc';
'require ui';

const callRCList = rpc.declare({
    object: 'rc',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

const callRCInit = rpc.declare({
    object: 'rc',
    method: 'init',
    params: ['name', 'action'],
    expect: { '': {} }
});

const callFileWrite = rpc.declare({
    object: 'file',
    method: 'write',
    params: ['path', 'data', 'append', 'mode']
});

const callFileRemove = rpc.declare({
    object: 'file',
    method: 'remove',
    params: ['path']
});

const callMomoGetPaths = rpc.declare({
    object: 'luci.momo',
    method: 'get_paths',
    expect: { '': {} }
});

const callMomoStatus = rpc.declare({
    object: 'luci.momo',
    method: 'status',
    expect: { '': {} }
});

const callMomoCommitConfig = rpc.declare({
    object: 'luci.momo',
    method: 'commit_config',
    expect: { '': {} }
});

const callMomoSaveRouteAppend = rpc.declare({
    object: 'luci.momo',
    method: 'save_route_append',
    params: ['prepend', 'append'],
    expect: { '': {} }
});

const callMomoVersion = rpc.declare({
    object: 'luci.momo',
    method: 'version',
    expect: { '': {} }
});

const callMomoFeatures = rpc.declare({
    object: 'luci.momo',
    method: 'features',
    expect: { '': {} }
});

const callMomoProfile = rpc.declare({
    object: 'luci.momo',
    method: 'profile',
    params: ['defaults'],
    expect: { '': {} }
});

const callMomoUpdateSubscription = rpc.declare({
    object: 'luci.momo',
    method: 'update_subscription',
    params: ['section_id'],
    expect: { '': {} }
});

const callMomoUpdateSubscriptions = rpc.declare({
    object: 'luci.momo',
    method: 'update_subscriptions',
    expect: { '': {} }
});

const callMomoSetProfile = rpc.declare({
    object: 'luci.momo',
    method: 'set_profile',
    params: ['profile'],
    expect: { '': {} }
});

const callMomoValidateProfile = rpc.declare({
    object: 'luci.momo',
    method: 'validate_profile',
    params: ['content'],
    expect: { '': {} }
});

const callMomoValidateProfilePath = rpc.declare({
    object: 'luci.momo',
    method: 'validate_profile_path',
    params: ['path'],
    expect: { '': {} }
});

const callMomoCheckProfilePath = rpc.declare({
    object: 'luci.momo',
    method: 'check_profile_path',
    params: ['path'],
    expect: { '': {} }
});

const callMomoLog = rpc.declare({
    object: 'luci.momo',
    method: 'log',
    params: ['type', 'log_len'],
    expect: { '': {} }
});

const callMomoAPI = rpc.declare({
    object: 'luci.momo',
    method: 'api',
    params: ['method', 'path', 'query', 'body'],
    expect: { '': {} }
});

const callMomoGetIdentifiers = rpc.declare({
    object: 'luci.momo',
    method: 'get_identifiers',
    expect: { '': {} }
});

const callMomoDebug = rpc.declare({
    object: 'luci.momo',
    method: 'debug',
    expect: { '': {} }
});

return baseclass.extend({
    notify: function (message, level) {
        level = level || 'info';
        const timeout = 30000;
        const notify = ui.addTimeLimitedNotification || ui.addNotification;

        if (notify === ui.addTimeLimitedNotification) {
            return ui.addTimeLimitedNotification(null, E('p', {}, message), timeout, level);
        }

        return ui.addNotification(null, E('p', {}, message), level);
    },

    action: function (promise, messages) {
        messages = messages || {};
        return Promise.resolve(promise).then(L.bind(function (result) {
            if (result && result.success === false) {
                this.notify(messages.failure || result.error || _('操作失败'), 'danger');
            } else if (messages.success) {
                this.notify(messages.success, 'info');
            }
            return result;
        }, this)).catch(L.bind(function (error) {
            this.notify(messages.failure || String(error) || _('操作失败'), 'danger');
            throw error;
        }, this));
    },

    getPaths: async function () {
        return callMomoGetPaths();
    },

    status: async function () {
        return !!(await callMomoStatus())?.running;
    },

    reload: function () {
        return this.action(callRCInit('momo', 'reload'), {
            success: _('服务已重新加载'),
            failure: _('服务重新加载失败')
        });
    },

    restart: function () {
        return this.action(callRCInit('momo', 'restart'), {
            success: _('服务已重启'),
            failure: _('服务重启失败')
        });
    },

    restartLocalSubconverter: function () {
        return this.action(callRCInit('momo-subconverter', 'restart'), {
            success: _('本地订阅转换服务已重启'),
            failure: _('本地订阅转换服务重启失败')
        });
    },

    writefile: function (path, data, mode) {
        data = (data != null) ? String(data) : '';
        mode = (mode != null) ? mode : 0o644;

        const chunkSize = 8 * 1024;

        if (data.length <= chunkSize) {
            return callFileWrite(path, data, false, mode);
        }

        let promise = Promise.resolve();
        for(let offset = 0; offset < data.length; offset += chunkSize) {
            const chunk = data.slice(offset, offset + chunkSize);
            const append = offset > 0;
            promise = promise.then(() => callFileWrite(path, chunk, append, mode));
        }

        return promise;
    },

    version: function () {
        return callMomoVersion();
    },

    features: function () {
        return callMomoFeatures();
    },

    commitConfig: function () {
        return callMomoCommitConfig();
    },

    saveRouteAppend: function (prepend, append) {
        return callMomoSaveRouteAppend(prepend || '[]', append || '[]');
    },

    profile: function (defaults) {
        return callMomoProfile(defaults);
    },

    updateSubscription: function (section_id) {
        return callMomoUpdateSubscription(section_id).then(L.bind(function (result) {
            if (result?.success) {
                this.notify(_('订阅更新成功：') + (result.name || section_id) + _('，规则数：') + (result.rule_count ?? 0), 'info');
            } else {
                this.notify(_('订阅更新失败：') + (result?.error || result?.name || section_id), 'danger');
            }
            return result;
        }, this)).catch(L.bind(function (error) {
            this.notify(_('订阅更新失败：') + String(error), 'danger');
            throw error;
        }, this));
    },

    updateSubscriptions: function () {
        return callMomoUpdateSubscriptions().then(L.bind(function (result) {
            const total = result?.results?.length || 0;
            const failed = (result?.results || []).filter(function (item) { return item && item.success === false; }).length;
            if (result?.success) {
                this.notify(_('全部订阅更新完成') + (total ? `：${total - failed}/${total}` : ''), 'info');
            } else {
                this.notify(_('全部订阅更新失败') + (total ? `：${failed}/${total}` : ''), 'danger');
            }
            return result;
        }, this)).catch(L.bind(function (error) {
            this.notify(_('全部订阅更新失败：') + String(error), 'danger');
            throw error;
        }, this));
    },

    setProfile: function (profile) {
        return this.action(callMomoSetProfile(profile), {
            success: _('配置已切换'),
            failure: _('配置切换失败')
        });
    },

    validateProfile: function (content) {
        return callMomoValidateProfile(content);
    },

    validateProfilePath: function (path) {
        return callMomoValidateProfilePath(path);
    },

    checkProfilePath: function (path) {
        return callMomoCheckProfilePath(path);
    },

    log: function (type, log_len) {
        return callMomoLog(type, String(log_len ?? 0));
    },

    updateDashboard: function () {
        return this.action(callMomoAPI('POST', '/upgrade/ui'), {
            success: _('面板已更新'),
            failure: _('面板更新失败')
        });
    },

    openDashboard: async function () {
        try {
            await uci.load('momo');
            const apiListen = uci.get('momo', 'mixin', 'external_control_api_listen') || '0.0.0.0:9090';
            const apiPort = apiListen.substring(apiListen.lastIndexOf(':') + 1) || '9090';
            const params = new URLSearchParams({
                hostname: window.location.hostname,
                port: apiPort
            });
            const apiSecret = uci.get('momo', 'mixin', 'external_control_api_secret');
            if (apiSecret) {
                params.set('secret', apiSecret);
            }
            const url = `http://${window.location.hostname}:${apiPort}/ui/?${params.toString()}#/proxies`;
            window.location.href = url;
        } catch (error) {
            this.notify(_('打开 Web 面板失败：') + String(error), 'danger');
        }
    },

    getIdentifiers: function () {
        return callMomoGetIdentifiers();
    },

    listProfiles: async function () {
        const paths = await this.getPaths();
        return L.resolveDefault(fs.list(paths.profiles_dir), []);
    },

    listSubscriptionFiles: async function () {
        const paths = await this.getPaths();
        return L.resolveDefault(fs.list(paths.subscriptions_dir), []);
    },

    removeFile: function (path) {
        return this.action(callFileRemove(path), {
            success: _('文件已删除'),
            failure: _('文件删除失败')
        });
    },

    removeFileQuiet: function (path) {
        return callFileRemove(path);
    },

    getAppLog: async function () {
        const paths = await this.getPaths();
        return L.resolveDefault(fs.read_direct(paths.app_log_path));
    },

    getCoreLog: async function () {
        const paths = await this.getPaths();
        return L.resolveDefault(fs.read_direct(paths.core_log_path));
    },

    clearAppLog: async function () {
        const paths = await this.getPaths();
        return this.action(this.writefile(paths.app_log_path), {
            success: _('应用日志已清空'),
            failure: _('应用日志清空失败')
        });
    },

    clearCoreLog: async function () {
        const paths = await this.getPaths();
        return this.action(this.writefile(paths.core_log_path), {
            success: _('核心日志已清空'),
            failure: _('核心日志清空失败')
        });
    },

    debug: function () {
        return this.action(callMomoDebug(), {
            success: _('调试日志已生成'),
            failure: _('调试日志生成失败')
        });
    },
})
