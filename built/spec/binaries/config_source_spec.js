"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const config_source_1 = require("../../lib/binaries/config_source");
const config_1 = require("../../lib/config");
class XMLConfig extends config_source_1.XmlConfigSource {
    constructor(name, xmlUrl) {
        super(name, xmlUrl);
        this.name = name;
        this.xmlUrl = xmlUrl;
    }
    getUrl(version) {
        return null;
    }
    getVersionList() {
        return null;
    }
    testGetXml() {
        return this.getXml();
    }
}
exports.XMLConfig = XMLConfig;
class JSONConfig extends config_source_1.GithubApiConfigSource {
    constructor(name, url) {
        super(name, url);
    }
    getUrl(version) {
        return null;
    }
    getVersionList() {
        return null;
    }
    testGetJson() {
        return this.getJson();
    }
}
exports.JSONConfig = JSONConfig;
describe('config', () => {
    describe('xml config source', () => {
        it('on start: should read the xml file and not check the timestamp', done => {
            spyOn(fs, 'readFileSync').and.callFake(() => {
                return `
        <?xml version='1.0' encoding='UTF-8'?>
        <ListBucketResult xmlns="http://doc.s3.amazonaws.com/2006-03-01">
          <Name>foobar-release</Name>
          <Contents>
            <Key>0.01/foobar.zip</Key>  
          </Contents>
        </ListBucketResult>
        `;
            });
            spyOn(fs, 'statSync').and.callFake(() => {
                return {
                    mtime: 0
                };
            });
            config_1.Config.runCommand = 'start';
            let xmlConfig = new XMLConfig('xml', 'url');
            xmlConfig.testGetXml()
                .then(xml => {
                expect(xml.ListBucketResult.Name).toEqual(['foobar-release']);
                done();
            })
                .catch(err => {
                done.fail(err);
            });
        });
        it('on udpate: should check the timestamp, invaidate cache, and try to make a web request', done => {
            spyOn(fs, 'readFileSync').and.callFake(() => {
                return 'foobar';
            });
            spyOn(fs, 'statSync').and.callFake(() => {
                return {
                    mtime: 0
                };
            });
            config_1.Config.runCommand = 'update';
            let xmlConfig = new XMLConfig('xml', 'url');
            xmlConfig.testGetXml()
                .then(xml => {
                // should do nothing
                done.fail('this should not work');
            })
                .catch(err => {
                expect(err.toString()).toContain('Invalid URI "url"');
                done();
            });
        });
        it('on update: if the size of the file is zero, invalidate the cache', done => {
            spyOn(fs, 'statSync').and.callFake(() => {
                return { size: 0 };
            });
            config_1.Config.runCommand = 'update';
            let xmlConfig = new XMLConfig('json', 'url');
            xmlConfig.testGetXml()
                .then(xml => {
                // should do nothing
                done.fail('this should not work');
            })
                .catch(err => {
                expect(err.toString()).toContain('Invalid URI "url"');
                done();
            });
        });
    });
    describe('github json', () => {
        it('on start: should read the json file and not check the timestamp', done => {
            spyOn(fs, 'readFileSync').and.callFake(() => {
                return '{ "foo": "bar" }';
            });
            spyOn(fs, 'statSync').and.callFake(() => {
                return {
                    mtime: 0
                };
            });
            config_1.Config.runCommand = 'start';
            let jsonConfig = new JSONConfig('json', 'url');
            jsonConfig.testGetJson()
                .then(json => {
                expect(json.foo).toEqual('bar');
                done();
            })
                .catch(err => {
                done.fail(err);
            });
        });
        it('on udpate: should check the timestamp, invaidate cache, and try to make a web request', done => {
            spyOn(fs, 'readFileSync').and.callFake(() => {
                return 'foobar';
            });
            spyOn(fs, 'statSync').and.callFake(() => {
                return {
                    mtime: 0
                };
            });
            config_1.Config.runCommand = 'update';
            let jsonConfig = new JSONConfig('json', 'url');
            jsonConfig.testGetJson()
                .then(json => {
                // should do nothing
                done.fail('this should not work');
            })
                .catch(err => {
                expect(err.toString()).toContain('Invalid URI "url"');
                done();
            });
        });
        it('on update: if the size of the file is zero, invalidate the cache', done => {
            spyOn(fs, 'statSync').and.callFake(() => {
                return { size: 0 };
            });
            config_1.Config.runCommand = 'update';
            let jsonConfig = new JSONConfig('json', 'url');
            jsonConfig.testGetJson()
                .then(json => {
                // should do nothing
                done.fail('this should not work');
            })
                .catch(err => {
                expect(err.toString()).toContain('Invalid URI "url"');
                done();
            });
        });
    });
});
//# sourceMappingURL=config_source_spec.js.map