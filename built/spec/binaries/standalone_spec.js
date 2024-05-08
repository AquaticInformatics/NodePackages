"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const rimraf = require("rimraf");
const standalone_1 = require("../../lib/binaries/standalone");
describe('standalone', () => {
    let out_dir = path.resolve('selenium_test');
    afterAll(() => {
        rimraf.sync(out_dir);
    });
    it('should get the id', () => {
        expect(new standalone_1.Standalone().id()).toEqual('standalone');
    });
    it('should get the url', (done) => {
        let standalone = new standalone_1.Standalone();
        standalone.configSource.out_dir = out_dir;
        standalone.getUrl('2.53.1').then(binaryUrl => {
            expect(binaryUrl.url).toContain('2.53/selenium-server-standalone-2.53.1.jar');
            done();
        });
    });
    it('should get the lists', (done) => {
        let standalone = new standalone_1.Standalone();
        standalone.configSource.out_dir = out_dir;
        standalone.configSource.osarch = 'x64';
        standalone.configSource.ostype = 'Darwin';
        standalone.getVersionList().then(list => {
            for (let item of list) {
                expect(item).toContain('selenium-server-standalone-');
            }
            done();
        });
    });
});
//# sourceMappingURL=standalone_spec.js.map