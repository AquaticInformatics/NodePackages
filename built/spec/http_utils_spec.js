"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../lib/config");
const http_utils_1 = require("../lib/http_utils");
describe('http utils', () => {
    let fileUrlHttp = 'http://foobar.com';
    let fileUrlHttps = 'https://foobar.com';
    let argProxy = 'http://foobar.arg';
    let envNoProxy = 'http://foobar.com';
    let envHttpProxy = 'http://foobar.env';
    let envHttpsProxy = 'https://foobar.env';
    it('should return undefined when proxy arg is not used', () => {
        let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttp);
        expect(proxy).toBeUndefined();
    });
    describe('proxy arg', () => {
        let opt_proxy = 'http://bar.foo';
        it('should return the proxy arg', () => {
            let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttp, opt_proxy);
            expect(proxy).toBe(opt_proxy);
        });
        it('should always return the proxy arg with env var set', () => {
            config_1.Config.httpProxy_ = envHttpProxy;
            config_1.Config.httpsProxy_ = envHttpsProxy;
            config_1.Config.noProxy_ = envNoProxy;
            let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttp, opt_proxy);
            expect(proxy).toBe(opt_proxy);
        });
    });
    describe('environment variables', () => {
        beforeEach(() => {
            config_1.Config.httpProxy_ = undefined;
            config_1.Config.httpsProxy_ = undefined;
            config_1.Config.noProxy_ = undefined;
        });
        it('should return the HTTP env variable', () => {
            config_1.Config.httpProxy_ = envHttpProxy;
            let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttp);
            expect(proxy).toBe(envHttpProxy);
        });
        it('should return the HTTPS env variable for https protocol', () => {
            config_1.Config.httpProxy_ = envHttpsProxy;
            let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttps);
            expect(proxy).toBe(envHttpsProxy);
        });
        it('should return the HTTP env variable for https protocol', () => {
            config_1.Config.httpProxy_ = envHttpProxy;
            let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttps);
            expect(proxy).toBe(envHttpProxy);
        });
        describe('NO_PROXY environment variable', () => {
            beforeEach(() => {
                config_1.Config.noProxy_ = undefined;
            });
            it('should return undefined when the NO_PROXY matches the fileUrl', () => {
                config_1.Config.noProxy_ = envNoProxy;
                let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttp);
                expect(proxy).toBeUndefined();
            });
            it('should return undefined when the no_proxy matches the fileUrl', () => {
                config_1.Config.noProxy_ = envNoProxy;
                let proxy = http_utils_1.HttpUtils.resolveProxy(fileUrlHttp);
                expect(proxy).toBeUndefined();
            });
        });
    });
});
//# sourceMappingURL=http_utils_spec.js.map