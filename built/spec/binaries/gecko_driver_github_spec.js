"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const rimraf = require("rimraf");
const gecko_driver_github_1 = require("../../lib/binaries/gecko_driver_github");
describe('gecko driver github', () => {
    let out_dir = path.resolve('selenium_test');
    afterAll(() => {
        rimraf.sync(out_dir);
    });
    it('should get version 0.13.0', (done) => {
        let geckoDriverGithub = new gecko_driver_github_1.GeckoDriverGithub();
        geckoDriverGithub.out_dir = out_dir;
        geckoDriverGithub.getUrl('v0.13.0').then(binaryUrl => {
            expect(binaryUrl.url)
                .toContain('https://github.com/mozilla/geckodriver/releases/download/v0.13.0/geckodriver-v');
            done();
        });
    });
    it('should get a version list', (done) => {
        let geckoDriverGithub = new gecko_driver_github_1.GeckoDriverGithub();
        geckoDriverGithub.out_dir = out_dir;
        geckoDriverGithub.getVersionList().then(list => {
            expect(list.length).toBeGreaterThan(0);
            done();
        });
    });
});
//# sourceMappingURL=gecko_driver_github_spec.js.map