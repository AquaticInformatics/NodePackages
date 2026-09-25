import { Observable } from 'rxjs';

type VersionParameter = string | number | undefined;
interface IEventConfig {
    minVersion?: VersionParameter;
    maxVersion?: VersionParameter;
    events: DynamicEvent[];
}
interface IEventConfigDefinition {
    configs: IEventConfig[];
}
type DynamicEvent = IDynamicEventWithEventAction | IDynamicEventWithSelector | ITimedEvent | IMouseEvent | IKeyboardEvent | IBeforeUnloadEvent | ISequence | IErrorEvent;
declare enum DynamicType {
    Simple = 0,// Standalone events. Trackable.
    Sequence = 1,// Complex events. Trigger multiple "StepEvents" first to trigger a "Sequence". Sequences may also be used to trigger other sequences. Trackable (optional).
    StepEvent = 2,// Similar to a "Simple" event but used as one step of a "Sequence". May optionally fire an analytics event when triggered. Not trackable.
    Error = 3
}
declare enum MiscellaneousEventAction {
    Beforeunload = "beforeunload",// Can be used to finalize a sequence. e.g. "Fire an event when the user begins to create some new data, but closes the browser without saving their changes". Trackable.
    Timed = "timed"
}
declare enum MouseEventAction {
    Click = "click",
    MouseOver = "mouseover",
    MouseOut = "mouseout",
    MouseDown = "mousedown",
    MouseUp = "mouseup"
}
declare enum KeyboardEventAction {
    KeyPress = "keypress",
    KeyDown = "keydown",
    KeyUp = "keyup"
}
type EventAction = MiscellaneousEventAction | MouseEventAction | KeyboardEventAction;
interface IDynamicEventBase {
    id: number;
    dynamicType: DynamicType;
    label?: string;
    message: string;
    additionalDataSelectors?: string[];
    additionalData?: (string | undefined)[];
    [key: string]: any;
}
interface IDynamicEventWithEventAction extends IDynamicEventBase {
    eventAction: EventAction;
}
interface IDynamicEventWithSelector extends IDynamicEventWithEventAction {
    selector: string;
    textContents?: string;
    matchExactTextContents?: boolean;
    guardSelector?: string;
    guardSelectorTextContents?: string;
    matchExactGuardSelectorTextContents?: boolean;
}
interface ITimedEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: typeof MiscellaneousEventAction.Timed;
    selector: undefined;
    timeout: number;
}
interface IMouseEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: MouseEventAction;
    selector: string;
}
interface IKeyboardEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: KeyboardEventAction;
    selector: string;
    isAlphaNumeric: boolean;
    keys?: string;
}
interface IBeforeUnloadEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: typeof MiscellaneousEventAction.Beforeunload;
    selector: string;
}
interface ISequence extends IDynamicEventBase {
    dynamicType: DynamicType.Sequence;
    steps: number[];
    cancelledBy: number[];
    isTrackable: boolean;
    timeout?: number;
}
interface IErrorEvent extends IDynamicEventBase {
    dynamicType: DynamicType.Error;
    error?: unknown;
}
/**
 * Optional hooks used to integrate {@link DynamicAnalyticsCore} with a host framework's
 * change-detection/digest cycle and HTTP stack. All hooks are optional; when omitted, the core
 * runs framework-free (plain function calls, native `fetch`), which is what plain JS/AngularJS/
 * React consumers get by default.
 */
interface DynamicAnalyticsCoreOptions {
    /**
     * Loads the remote JSON configuration for a given URL. Defaults to a `fetch`-based
     * implementation. Override to route requests through a framework's HTTP client (e.g. Angular's
     * `HttpClient`) for interceptor/testing support.
     */
    configLoader?: (url: string) => Observable<IEventConfigDefinition | undefined>;
    /**
     * Runs a function outside of any change-detection/digest zone (e.g. Angular's
     * `NgZone.runOutsideAngular`). Defaults to calling the function directly.
     */
    runOutsideZone?: (fn: () => void) => void;
    /**
     * Runs a function inside a change-detection/digest zone so framework bindings observing
     * `onEvent`-driven state re-render (e.g. Angular's `NgZone.run`, or AngularJS's
     * `$rootScope.$applyAsync`). Defaults to calling the function directly.
     */
    runInZone?: (fn: () => void) => void;
}

/** Name of the AngularJS module registered by {@link registerDynamicAnalyticsAngularJsModule}. */
declare const DYNAMIC_ANALYTICS_ANGULARJS_MODULE_NAME = "dynamicAnalytics";
/** Name of the AngularJS service registered on the module. */
declare const DYNAMIC_ANALYTICS_ANGULARJS_SERVICE_NAME = "dynamicAnalyticsService";
/**
 * Minimal structural type for the piece of AngularJS's `$rootScope` this wrapper needs. Declared
 * locally (rather than depending on `@types/angular`) so this package has no AngularJS-specific
 * type dependency.
 */
interface AngularJsRootScopeLike {
    $applyAsync(fn?: () => void): void;
}
/**
 * Registers an AngularJS 1.x module (`dynamicAnalytics`) exposing a `dynamicAnalyticsService`
 * that wraps {@link DynamicAnalyticsCore}. Event notifications (`onEvent`) are re-entered via
 * `$rootScope.$applyAsync`, so AngularJS bindings/watchers reacting to those events still update.
 *
 * @param angularInstance The global `angular` object. Typed as `any` to avoid a hard dependency on
 * AngularJS's types; pass in whatever `angular` module/global your app already uses.
 * @param options Optional overrides for the underlying {@link DynamicAnalyticsCore}. `runInZone`
 * is provided automatically (via `$rootScope.$applyAsync`) unless you supply your own.
 * @returns The registered module name (`dynamicAnalytics`), for convenience when listing app
 * dependencies (e.g. `angular.module('myApp', [registerDynamicAnalyticsAngularJsModule(angular)])`).
 *
 * @example
 * ```js
 * import angular from 'angular';
 * import { registerDynamicAnalyticsAngularJsModule } from 'dynamic-analytics-core/angularjs';
 *
 * const dynamicAnalyticsModuleName = registerDynamicAnalyticsAngularJsModule(angular);
 * angular.module('myApp', [dynamicAnalyticsModuleName]);
 *
 * // Elsewhere, injected like any other AngularJS service:
 * // function MyController(dynamicAnalyticsService) { ... }
 * ```
 */
declare function registerDynamicAnalyticsAngularJsModule(angularInstance: any, options?: DynamicAnalyticsCoreOptions): string;

export { type AngularJsRootScopeLike, DYNAMIC_ANALYTICS_ANGULARJS_MODULE_NAME, DYNAMIC_ANALYTICS_ANGULARJS_SERVICE_NAME, registerDynamicAnalyticsAngularJsModule };
