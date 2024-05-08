"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_instance_1 = require("../lib/cli_instance");
const utils_1 = require("../lib/utils");
describe('cli', () => {
    describe('help', () => {
        it('should have usage and commands', () => {
            let lines = utils_1.spawnSync(process.execPath, ['built/lib/webdriver.js', 'help'], 'pipe')
                .output[1]
                .toString()
                .split('\n');
            // very specific to make sure the
            let index = 0;
            expect(lines[index++].indexOf('Usage:')).toBe(0);
            index++;
            expect(lines[index++].indexOf('Commands:')).toBe(0);
            for (let cmd in cli_instance_1.cli.programs) {
                expect(lines[index++].indexOf(cmd)).toBe(2);
            }
            index++;
            expect(lines[index++].indexOf('Options:')).toBe(0);
            let options = cli_instance_1.cli.getOptions();
            for (let opt in options) {
                expect(lines[index++].indexOf('--' + opt)).toBe(2);
            }
        });
    });
});
//# sourceMappingURL=webdriver_spec.js.map