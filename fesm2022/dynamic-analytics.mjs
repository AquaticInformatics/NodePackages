import * as i1 from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import * as i0 from '@angular/core';
import { Injectable } from '@angular/core';
import { DynamicAnalyticsCore } from 'dynamic-analytics-core';
export * from 'dynamic-analytics-core';

/**
 * Angular wrapper around the framework-agnostic {@link DynamicAnalyticsCore} (see the
 * `dynamic-analytics-core` package). All engine logic (DOM event delegation, sequences,
 * configuration validation, etc.) lives in the core; this class only supplies Angular-specific
 * integration:
 * - `@Injectable({providedIn: 'root'})` for Angular DI.
 * - Configuration fetches routed through Angular's `HttpClient` (so interceptors, testing via
 *   `HttpTestingController`, etc. keep working exactly as before).
 * - Listener setup/teardown run outside `NgZone`, and `onEvent` notifications re-enter it, so
 *   Angular change detection behaves the same as it always has.
 *
 * If you need this in a non-Angular app (plain JS, AngularJS 1.x, React, etc.), use
 * `dynamic-analytics-core` directly instead.
 */
class DynamicAnalyticsService extends DynamicAnalyticsCore {
    constructor(httpBackend, zone) {
        const httpClient = new HttpClient(httpBackend);
        super({
            configLoader: url => httpClient.get(url),
            runOutsideZone: fn => zone.runOutsideAngular(fn),
            runInZone: fn => zone.run(fn),
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.4", ngImport: i0, type: DynamicAnalyticsService, deps: [{ token: i1.HttpBackend }, { token: i0.NgZone }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.4", ngImport: i0, type: DynamicAnalyticsService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.4", ngImport: i0, type: DynamicAnalyticsService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpBackend }, { type: i0.NgZone }] });

/*
 * Public API Surface of dynamic-analytics
 */

/**
 * Generated bundle index. Do not edit.
 */

export { DynamicAnalyticsService };
//# sourceMappingURL=dynamic-analytics.mjs.map
