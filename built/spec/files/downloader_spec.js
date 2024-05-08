"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const files_1 = require("../../lib/files");
describe('downloader', () => {
    describe('get file', () => {
        let fileUrl = 'https://selenium-release.storage.googleapis.com/3.0/selenium-server-standalone-3.0.0.jar';
        let fileName = 'foobar.jar';
        let outputDir = path.resolve('selenium_test');
        let actualContentLength = 22138949;
        let contentLength;
        beforeEach(() => {
            try {
                // if the folder does not exist, it will throw an error on statSync
                if (fs.statSync(outputDir).isDirectory()) {
                    rimraf.sync(outputDir);
                }
            }
            catch (err) {
                // do nothing, the directory does not exist
            }
            fs.mkdirSync(outputDir);
        });
        xit('should download a file with mismatch content length', (done) => {
            contentLength = 0;
            files_1.Downloader.getFile(null, fileUrl, fileName, outputDir, contentLength)
                .then(result => {
                expect(result).toBeTruthy();
                let file = path.resolve(outputDir, fileName);
                let stat = fs.statSync(file);
                expect(stat.size).toEqual(actualContentLength);
                rimraf.sync(file);
                done();
            })
                .catch(error => {
                console.log(error);
                done.fail();
            });
        });
        it('should not download a file if the content lengths match', (done) => {
            contentLength = actualContentLength;
            files_1.Downloader.getFile(null, fileUrl, fileName, outputDir, contentLength)
                .then(result => {
                expect(result).not.toBeTruthy();
                let file = path.resolve(outputDir, fileName);
                try {
                    let access = fs.accessSync(file);
                }
                catch (err) {
                    err.code === 'ENOENT';
                }
                done();
            })
                .catch(error => {
                console.log(error);
                done.fail();
            });
        });
    });
});
//# sourceMappingURL=downloader_spec.js.map