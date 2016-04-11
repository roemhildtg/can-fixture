/*xhr*/
define(function (require, exports, module) {
    var fixtureCore = require('./core');
    var canSet = require('can-set');
    var helpers = canSet.helpers;
    var deparam = require('./helpers/deparam');
    var XHR = XMLHttpRequest, GLOBAL = typeof global !== 'undefined' ? global : window;
    function callEvents(xhr, ev) {
        var evs = xhr.__events[ev] || [], fn;
        for (var i = 0, len = evs.length; i < len; i++) {
            fn = evs[i];
            fn.call(xhr);
        }
    }
    var assign = function (dest, source, excluding) {
        excluding = excluding || {};
        for (var prop in source) {
            if (!(prop in XMLHttpRequest.prototype) && !excluding[prop]) {
                dest[prop] = source[prop];
            }
        }
    };
    var makeXHR = function (mockXHR) {
        var xhr = new XHR();
        assign(xhr, mockXHR);
        xhr.onreadystatechange = function (ev) {
            assign(mockXHR, xhr, {
                onreadystatechange: true,
                onload: true
            });
            if (mockXHR.onreadystatechange) {
                mockXHR.onreadystatechange(ev);
            }
        };
        xhr.onload = function () {
            callEvents(mockXHR, 'load');
            if (mockXHR.onload) {
                return mockXHR.onload.apply(mockXHR, arguments);
            }
        };
        if (xhr.getResponseHeader) {
            mockXHR.getResponseHeader = function () {
                return xhr.getResponseHeader.apply(xhr, arguments);
            };
        }
        if (mockXHR._disableHeaderCheck && xhr.setDisableHeaderCheck) {
            xhr.setDisableHeaderCheck(true);
        }
        return xhr;
    };
    GLOBAL.XMLHttpRequest = function () {
        var headers = this._headers = {};
        this._xhr = {
            getAllResponseHeaders: function () {
                return headers;
            }
        };
        this.__events = {};
        this.onload = null;
        this.onerror = null;
    };
    helpers.extend(XMLHttpRequest.prototype, {
        setRequestHeader: function (name, value) {
            this._headers[name] = value;
        },
        open: function (type, url) {
            this.type = type;
            this.url = url;
        },
        getAllResponseHeaders: function () {
            return this._xhr.getAllResponseHeaders.apply(this._xhr, arguments);
        },
        addEventListener: function (ev, fn) {
            var evs = this.__events[ev] = this.__events[ev] || [];
            evs.push(fn);
        },
        removeEventListener: function (ev, fn) {
            var evs = this.__events[ev] = this.__events[ev] || [];
            var idx = evs.indexOf(fn);
            if (idx >= 0) {
                evs.splice(idx, 1);
            }
        },
        setDisableHeaderCheck: function (val) {
            this._disableHeaderCheck = !!val;
        },
        getResponseHeader: function (key) {
            return '';
        },
        send: function (data) {
            var xhrSettings = {
                url: this.url,
                data: data,
                headers: this._headers,
                type: this.type.toLowerCase() || 'get'
            };
            if (!xhrSettings.data && xhrSettings.type === 'get' || xhrSettings.type === 'delete') {
                xhrSettings.data = deparam(xhrSettings.url.split('?')[1]);
                xhrSettings.url = xhrSettings.url.split('?')[0];
            }
            if (typeof xhrSettings.data === 'string') {
                try {
                    xhrSettings.data = JSON.parse(xhrSettings.data);
                } catch (e) {
                    xhrSettings.data = deparam(xhrSettings.data);
                }
            }
            var fixtureSettings = fixtureCore.get(xhrSettings);
            if (fixtureSettings && typeof fixtureSettings.fixture === 'function') {
                var mockXHR = this;
                return fixtureCore.callDynamicFixture(xhrSettings, fixtureSettings, function (status, body, headers, statusText) {
                    body = typeof body === 'string' ? body : JSON.stringify(body);
                    helpers.extend(mockXHR, {
                        readyState: 4,
                        status: status
                    });
                    if (status >= 200 && status < 300 || status === 304) {
                        helpers.extend(mockXHR, {
                            statusText: statusText || 'OK',
                            responseText: body
                        });
                    } else {
                        helpers.extend(mockXHR, {
                            statusText: statusText || 'error',
                            responseText: body
                        });
                    }
                    if (mockXHR.onreadystatechange) {
                        mockXHR.onreadystatechange({ target: mockXHR });
                    }
                    if (mockXHR.onload) {
                        mockXHR.onload();
                    }
                });
            }
            var xhr = makeXHR(this);
            if (fixtureSettings) {
                helpers.extend(xhr, fixtureSettings);
            }
            this._xhr = xhr;
            xhr.open(xhr.type, xhr.url);
            return xhr.send(data);
        }
    });
});