var merge = require('./merge');
var normalize = require('./normalize');

var parseUrl = require('parseurl');
var _ = require('lodash');
var config;

exports = module.exports = restEmulator;

function restEmulator(listMockConfig, options) {

    options = options || {};

    updateConfig(listMockConfig);

    log('Mock urls: ', _.keys(config));
    log('Mock data:', config);

    return {
        middleware: middleware,
        updateConfig: updateConfig
    };

    function updateConfig(listMockConfig) {
        if (!listMockConfig) {
            throw new TypeError('restEmulator() mock config required');
        }

        if (!_.isArray(listMockConfig)) {
            listMockConfig = _.toArray(listMockConfig);
        }

        config = _.reduce(listMockConfig, getNormalizeConfig, {});
    }

    function middleware(req, res, next) {
        var url = parseUrl(req);
        var preset;


        if (!_.contains(_.keys(config), url.pathname)) {
            return next();
        }

        preset = getCurrentPreset(req, config[url.pathname]);

        var bodyRaw = "";
        var bodyJson = undefined;
        if (preset) {
            if (typeof preset.data === "function") {
                req.on("data", function (chunk) {
                    bodyRaw += chunk;
                });
                req.on("end", function () {
                    if (bodyRaw) {
                        bodyJson = JSON.parse(bodyRaw);
                    }
                });
            }
            setTimeout(timeout, preset.timeout);
        } else {
            return next();
        }

        function timeout() {
            if (_.keys(preset.query).length && _.keys(req.query).length) {
                var querystring = require('querystring');

                var queryData = _.find(preset.query, function (data, keyQuery) {
                    var remoteQuery = req.query;
                    var presetQuery = querystring.parse(keyQuery);

                    return _.isEqual(remoteQuery, presetQuery);
                });

                if (queryData) {
                    return response(queryData);
                }

            }
            return response(preset);
        }

        function response(preset) {
            if (preset.headers) {
                res.set(preset.headers);
            }
            res.statusCode = preset.code;
            var data;
            if (preset.raw) {
                data = preset.data;
            } else {
                if (typeof preset.data === "function") {
                    data = JSON.stringify(preset.data(req, bodyJson, bodyRaw));
                } else {
                    data = JSON.stringify(preset.data);
                }
            }

            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

            res.write(data);
            res.end();
            return true;
        }
    }

    function getCurrentPreset(req, methods) {
        var presets = methods[req.method];
        var query = require('url').parse(req.url, true).query;
        var presetName = query.restEmulatorPreset || 'default';
        return presets ? presets[presetName] : false;
    }

    function getNormalizeConfig(config, rawConfig) {
        return merge(config, normalize(rawConfig));
    }

    function log(message, data) {
        if (options.verbose) {
            console.log(message, data);
        }
    }
}
