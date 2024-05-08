"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const logger_1 = require("../../lib/cli/logger");
const update_1 = require("../../lib/cmds/update");
const config_1 = require("../../lib/config");
let argv = {};
describe('update', () => {
    describe('for update-config.json', () => {
        let tmpDir = '';
        beforeEach(() => {
            logger_1.Logger.writeTo = logger_1.WriteTo.NONE;
            tmpDir = path.resolve('selenium_test');
            try {
                // if the folder does not exist, it will throw an error on statSync
                if (fs.statSync(tmpDir).isDirectory()) {
                    rimraf.sync(tmpDir);
                }
            }
            catch (err) {
                // do nothing, the directory does not exist
            }
            fs.mkdirSync(tmpDir);
        });
        afterEach(() => {
            rimraf.sync(tmpDir);
            update_1.clearBrowserFile();
        });
        it('should create a file for chrome', (done) => {
            config_1.Config.osType_ = 'Linux';
            config_1.Config.osArch_ = 'x64';
            argv = {
                '_': ['update'],
                'versions': { 'chrome': '2.20' },
                'standalone': false,
                'gecko': false,
                'out_dir': tmpDir
            };
            update_1.program.run(JSON.parse(JSON.stringify(argv)))
                .then(() => {
                let updateConfig = fs.readFileSync(path.resolve(tmpDir, 'update-config.json')).toString();
                let updateObj = JSON.parse(updateConfig);
                expect(updateObj['chrome']['last']).toContain('chromedriver_2.20');
                expect(updateObj['chrome']['all'].length).toEqual(1);
                expect(updateObj['chrome']['last']).toEqual(updateObj['chrome']['all'][0]);
                expect(updateObj['standalone']).toBeUndefined();
                expect(updateObj['ie']).toBeUndefined();
                done();
            })
                .catch((err) => { done.fail(); });
        });
        xit('should create a file for standalone', (done) => {
            config_1.Config.osType_ = 'Linux';
            config_1.Config.osArch_ = 'x64';
            argv = {
                '_': ['update'],
                'versions': { 'standalone': '2.53.1' },
                'chrome': false,
                'gecko': false,
                'out_dir': tmpDir
            };
            update_1.program.run(JSON.parse(JSON.stringify(argv)))
                .then(() => {
                let updateConfig = fs.readFileSync(path.resolve(tmpDir, 'update-config.json')).toString();
                let updateObj = JSON.parse(updateConfig);
                expect(updateObj['standalone']['last']).toContain('standalone-2.53.1.jar');
                expect(updateObj['standalone']['all'].length).toEqual(1);
                expect(updateObj['standalone']['last']).toEqual(updateObj['standalone']['all'][0]);
                expect(updateObj['chrome']).toBeUndefined();
                expect(updateObj['ie']).toBeUndefined();
                done();
            })
                .catch((err) => { done.fail(); });
        });
        // TODO(cnishina): Create a test for Windows for IE driver. This will require rewriting
        // how programs get configurations.
    });
});
//# sourceMappingURL=update_spec.js.map