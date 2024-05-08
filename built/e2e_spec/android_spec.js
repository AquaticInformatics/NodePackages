"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webdriver = require("selenium-webdriver");
const binaries_1 = require("../lib/binaries");
let versions = require('../config.json').webdriverVersions;
describe('browser smoke tests', () => {
    it('should be able to boot up android chrome', (done) => {
        let driver = new webdriver.Builder()
            .usingServer('http://localhost:4723/wd/hub')
            .withCapabilities({
            browserName: 'chrome',
            platformName: 'Android',
            platformVersion: binaries_1.AndroidSDK.VERSIONS[parseInt(binaries_1.AndroidSDK.DEFAULT_API_LEVELS.split(',')[0])],
            deviceName: 'Android Emulator'
        })
            .build();
        driver.get('http://10.0.2.2:4723/wd/hub/status')
            .then(() => {
            return driver.getPageSource();
        })
            .then((source) => {
            expect(source).toContain('"status":0');
            return driver.quit();
        })
            .then(() => {
            done();
        });
    }, 10 * 60 * 1000);
});
//# sourceMappingURL=android_spec.js.map