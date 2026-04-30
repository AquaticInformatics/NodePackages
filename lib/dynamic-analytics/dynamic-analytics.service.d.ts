import { HttpBackend } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import * as i0 from "@angular/core";
export type VersionParameter = string | number | undefined;
export interface IEventConfig {
    minVersion?: VersionParameter;
    maxVersion?: VersionParameter;
    events: DynamicEvent[];
}
export interface IEventConfigDefinition {
    configs: IEventConfig[];
}
export type DynamicEvent = IDynamicEventWithEventAction | IDynamicEventWithSelector | ITimedEvent | IMouseEvent | IKeyboardEvent | IBeforeUnloadEvent | ISequence;
export declare enum DynamicType {
    Simple = 0,// Standalone events. Trackable.
    Sequence = 1,// Complex events. Trigger multiple "StepEvents" first to trigger a "Sequence". Sequences may also be used to trigger other sequences. Trackable (optional).
    StepEvent = 2
}
export declare enum MiscellaneousEventAction {
    Beforeunload = "beforeunload",// Can be used to finalize a sequence. e.g. "Fire an event when the user begins to create some new data, but closes the browser without saving their changes". Trackable.
    Timed = "timed"
}
export declare enum MouseEventAction {
    Click = "click",
    MouseOver = "mouseover",
    MouseOut = "mouseout",
    MouseDown = "mousedown",
    MouseUp = "mouseup"
}
export declare enum KeyboardEventAction {
    KeyPress = "keypress",
    KeyDown = "keydown",
    KeyUp = "keyup"
}
export type EventAction = MiscellaneousEventAction | MouseEventAction | KeyboardEventAction;
interface IDynamicEventBase {
    id: number;
    dynamicType: DynamicType;
    label?: string;
    message: string;
    additionalDataSelectors?: string[];
    additionalData?: (string | undefined)[];
    [key: string]: any;
}
export interface IDynamicEventWithEventAction extends IDynamicEventBase {
    eventAction: EventAction;
}
export interface IDynamicEventWithSelector extends IDynamicEventWithEventAction {
    selector: string;
    statusSelector?: string;
    textContents?: string;
    matchExactTextContents?: boolean;
}
export interface ISimpleEvent extends IDynamicEventWithSelector {
    dynamicType: DynamicType.Simple;
}
export interface IStepEvent extends IDynamicEventWithSelector {
    dynamicType: DynamicType.StepEvent;
    additionalDataSelectors: undefined;
}
export interface ITimedEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: MiscellaneousEventAction.Timed;
    selector: undefined;
    timeout: number;
}
export interface IMouseEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: MouseEventAction;
    selector: string;
}
export interface IKeyboardEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: KeyboardEventAction;
    selector: string;
    isAlphaNumeric: boolean;
}
export interface IBeforeUnloadEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.StepEvent | DynamicType.Simple;
    eventAction: MiscellaneousEventAction.Beforeunload;
    selector: string;
}
export interface ISequence extends IDynamicEventBase {
    dynamicType: DynamicType.Sequence;
    steps: number[];
    cancelledBy: number[];
    isTrackable: boolean;
    timeout?: number;
}
export declare class DynamicAnalyticsService {
    private zone;
    /** Emits tracked events (Simple events and completed trackable Sequences). Subscribe to forward events to your analytics backend. */
    readonly onEvent: Subject<DynamicEvent>;
    /** Enable to log tracking activity to the console for debugging. */
    loggingEnabled: boolean;
    private httpClient;
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
    constructor(httpBackend: HttpBackend, zone: NgZone);
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
    static ɵfac: i0.ɵɵFactoryDeclaration<DynamicAnalyticsService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DynamicAnalyticsService>;
}
export {};
