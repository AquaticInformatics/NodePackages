"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const rimraf = require("rimraf");
const iedriver_xml_1 = require("../../lib/binaries/iedriver_xml");
describe('iedriver xml', () => {
    let out_dir = path.resolve('selenium_test');
    afterAll(() => {
        rimraf.sync(out_dir);
    });
    it('should get version 2.53.1', (done) => {
        let iedriverXml = new iedriver_xml_1.IEDriverXml();
        iedriverXml.out_dir = out_dir;
        iedriverXml.getUrl('2.53.1').then(binaryUrl => {
            expect(binaryUrl.url)
                .toEqual('https://selenium-release.storage.googleapis.com/2.53/IEDriverServer_Win32_2.53.1.zip');
            done();
        });
    });
});
//# sourceMappingURL=iedriver_xml_spec.js.map