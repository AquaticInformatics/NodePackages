import { HttpBackend } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { DynamicAnalyticsCore } from 'dynamic-analytics-core';
import * as i0 from "@angular/core";
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
export declare class DynamicAnalyticsService extends DynamicAnalyticsCore {
    constructor(httpBackend: HttpBackend, zone: NgZone);
    static ɵfac: i0.ɵɵFactoryDeclaration<DynamicAnalyticsService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DynamicAnalyticsService>;
}
