import { Observable, Subject } from 'rxjs';

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
interface ISimpleEvent extends IDynamicEventWithSelector {
    dynamicType: DynamicType.Simple;
}
interface IStepEvent extends IDynamicEventWithSelector {
    dynamicType: DynamicType.StepEvent;
    additionalDataSelectors: undefined;
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
/**
 * Framework-agnostic dynamic analytics engine. Works in any JS environment (plain JS, AngularJS
 * 1.x, React, etc.) with no required dependencies beyond `rxjs` and `lodash`.
 */
declare class DynamicAnalyticsCore {
    /** Emits tracked events (Simple events and completed trackable Sequences) as well as failures (when `errorTrackingEnabled` is true). Subscribe to forward events to your analytics backend. */
    readonly onEvent: Subject<DynamicEvent>;
    /** Enable to log tracking activity to the console for debugging. */
    loggingEnabled: boolean;
    /** Enable to emit failures (e.g. invalid configurations or unexpected runtime errors) via `onEvent` so they can be tracked in your analytics system. */
    errorTrackingEnabled: boolean;
    private versionFilterPredicate;
    private translateTextContentFn?;
    private filteredEvents;
    private sequences;
    private delegatedHandlers;
    private beforeUnloadHandler?;
    private isInitialized;
    private readonly sequenceTracker;
    private readonly timedEventForSequenceTracker;
    private readonly blockedSequenceIds;
    private delegatedConfigsByEventAction;
    private documentConfigsByEventAction;
    private beforeUnloadConfigs;
    private configsNeedingStatusSelectorCheck;
    private sequencesByStepEventId;
    private sequencesByCancelEventId;
    private readonly configLoader;
    private readonly runOutsideZone;
    private readonly runInZone;
    constructor(options?: DynamicAnalyticsCoreOptions);
    /**
     * Initialize from a remote JSON configuration URL.
     * @param url URL to fetch the IEventConfigDefinition JSON from.
     * @param versionFilterPredicate Predicate that receives each config's minVersion/maxVersion and returns true if the config applies to the current app version.
     * @param translateTextContent Optional callback to translate textContents values at initialization time. Receives each textContents string and should return its translated equivalent (or the original string if no translation is needed).
     */
    initialize(url: string, versionFilterPredicate: (minVersion: VersionParameter, maxVersion: VersionParameter) => boolean, translateTextContent?: (textContent: string) => string): void;
    /**
     * Initialize directly from an in-memory configuration object. Useful for development and testing.
     * @param eventConfigDefinition The configuration object containing event definitions.
     * @param versionFilterPredicate Predicate that receives each config's minVersion/maxVersion and returns true if the config applies to the current app version.
     * @param translateTextContent Optional callback to translate textContents values at initialization time. Receives each textContents string and should return its translated equivalent (or the original string if no translation is needed).
     */
    initializeWithConfig(eventConfigDefinition: IEventConfigDefinition, versionFilterPredicate: (minVersion: VersionParameter, maxVersion: VersionParameter) => boolean, translateTextContent?: (textContent: string) => string): void;
    /**
     * Tear down all event listeners and reset internal state.
     * Call before re-initializing or when the host component is destroyed.
     */
    destroy(): void;
    private initializeAnalyticsConfiguration;
    private initializeEventConfigDefinition;
    private applyTextContentTranslations;
    private precomputeListenerConfiguration;
    private buildReverseLookupMaps;
    private installDelegatedListeners;
    private installBeforeUnloadListener;
    private handleDelegatedEvent;
    private isValidForStatusSelector;
    private elementMatchesText;
    private isValidForTextContents;
    private closestMatching;
    private getConfiguration$;
    private getOnDynamicEventHandler;
    private doesElementMatchConfig;
    private onSimpleOrStepEvent;
    private shouldTrackKeyboardEvent;
    private onBeforeUnload;
    private trackEvent;
    private getAdditionalEventData;
    private isAlphaNumericKeyboardEvent;
    private log;
    /** Logs a failure to the console and, when `errorTrackingEnabled` is true, emits it via `onEvent` so consuming applications can track it in their analytics system. */
    private trackError;
    private formatDynamicEventString;
    private getSequenceProgress;
    private onStepEvent;
    private startTimedEventTimerForSequence;
    private resetTimersForSequence;
    private startSequenceTimeout;
    private resetSequence;
    private trackAndResetSequence;
    private logEvent;
    private isStepEvent;
    private isSimpleEvent;
    private isBeforeUnloadEventType;
    private isKeyboardEventType;
    private isDynamicEventWithSelector;
    private isSequence;
    private isTimedEvent;
    private doesEventTargetTriggerStepEvent;
    private validateEventConfigDefinition;
    private clearAllSequenceState;
}

export { DynamicAnalyticsCore, type DynamicAnalyticsCoreOptions, type DynamicEvent, DynamicType, type EventAction, type IBeforeUnloadEvent, type IDynamicEventWithEventAction, type IDynamicEventWithSelector, type IErrorEvent, type IEventConfig, type IEventConfigDefinition, type IKeyboardEvent, type IMouseEvent, type ISequence, type ISimpleEvent, type IStepEvent, type ITimedEvent, KeyboardEventAction, MiscellaneousEventAction, MouseEventAction, type VersionParameter };
