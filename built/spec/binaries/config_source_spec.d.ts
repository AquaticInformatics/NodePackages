import { GithubApiConfigSource, XmlConfigSource } from '../../lib/binaries/config_source';
export declare class XMLConfig extends XmlConfigSource {
    name: string;
    xmlUrl: string;
    constructor(name: string, xmlUrl: string);
    getUrl(version: string): Promise<{
        url: string;
        version: string;
    }>;
    getVersionList(): Promise<string[]>;
    testGetXml(): Promise<any>;
}
export declare class JSONConfig extends GithubApiConfigSource {
    constructor(name: string, url: string);
    getUrl(version: string): Promise<{
        url: string;
        version: string;
    }>;
    getVersionList(): Promise<string[]>;
    testGetJson(): Promise<any>;
}
