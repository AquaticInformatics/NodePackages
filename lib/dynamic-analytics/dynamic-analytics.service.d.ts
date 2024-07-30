import { HttpBackend } from '@angular/common/http';
import { Subject } from 'rxjs';
import * as i0 from "@angular/core";
type VersionParameter = string | number | undefined;
export interface IEventConfig {
    minVersion: VersionParameter;
    maxVersion: VersionParameter;
    events: DynamicEvent[];
}
export interface IEventConfigDefinition {
    configs: IEventConfig[];
}
export type DynamicEvent = IDynamicEventWithEventAction | IDynamicEventWithSelector | ITimedEvent | IMouseEvent | IKeyboardEvent | IBeforeUnloadEvent | ISequence;
export declare enum DynamicType {
    Simple = 0,// Standalone events. Trackable.
    Sequence = 1,// Complex events. Trigger multiple "SequenceEvents" first to trigger a "Sequence". Sequences may also be used to trigger other sequences. Trackable (optional).
    SequenceEvent = 2
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
    message: string;
    additionalDataSelector?: string;
    additionalData?: string;
}
export interface IDynamicEventWithEventAction extends IDynamicEventBase {
    eventAction: EventAction;
}
export interface IDynamicEventWithSelector extends IDynamicEventWithEventAction {
    selector: string;
    statusSelector?: string;
}
interface ITimedEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.SequenceEvent | DynamicType.Simple;
    eventAction: MiscellaneousEventAction.Timed;
    selector: undefined;
    timeout: number;
}
interface IMouseEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.SequenceEvent | DynamicType.Simple;
    eventAction: MouseEventAction;
    selector: string;
}
interface IKeyboardEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.SequenceEvent | DynamicType.Simple;
    eventAction: KeyboardEventAction;
    selector: string;
    isAlphaNumeric: boolean;
}
interface IBeforeUnloadEvent extends IDynamicEventWithEventAction {
    dynamicType: DynamicType.SequenceEvent | DynamicType.Simple;
    eventAction: MiscellaneousEventAction.Beforeunload;
    selector: string;
}
interface ISequence extends IDynamicEventBase {
    dynamicType: DynamicType.Sequence;
    sequenceEvents: number[];
    cancelEvents: number[];
    isTrackable: boolean;
}
export declare class DynamicAnalyticsService {
    readonly onEvent: Subject<DynamicEvent>;
    private versionFilterPredicate;
    private httpClient;
    private eventRecords;
    loggingEnabled: boolean;
    constructor(httpBackend: HttpBackend);
    private readonly domChanged$;
    private readonly observer;
    private readonly sequenceTracker;
    private readonly timedEventForSequenceTracker;
    private readonly blockedSequenceIds;
    private filteredEvents;
    private documentConfigListeners;
    private beforeUnloadConfigListeners;
    private onDomChanged;
    initialize(url: string, versionFilterPredicate: (minVersion: VersionParameter, maxVersion: VersionParameter) => boolean): void;
    initializeWithConfig(eventConfigDefinition: IEventConfigDefinition, versionFilterPredicate: (minVersion: VersionParameter, maxVersion: VersionParameter) => boolean): void;
    private initializeMutationObserver;
    private initializeAnalyticsConfiguration;
    private initializeEventConfigDefinition;
    private getConfiguration$;
    private hasEventListener;
    private getEventRecord;
    private cleanupEventRecords;
    private addEventListener;
    private getOnDynamicEventHandler;
    private log;
    private onSimpleOrSequenceEvent;
    private getAdditionalEventData;
    private isAlphaNumericKeyboardEvent;
    private onDocumentClicked;
    private onBeforeUnload;
    private formatDynamicEventString;
    private getSequenceProgress;
    private onSequenceEvent;
    private startTimedEventTimerForSequence;
    private resetTimersForSequence;
    private resetSequence;
    private trackAndResetSequence;
    private trackEvent;
    private logEvent;
    private isSequenceEvent;
    private isSimpleEvent;
    private isDynamicEventWithEventType;
    private isBeforeUnloadEventType;
    private isKeyboardEventType;
    private isDynamicEventWithSelector;
    private isSequence;
    private isTimedEvent;
    private doesEventTargetTriggerSequenceEvent;
    private validateEventConfigDefinition;
    static ɵfac: i0.ɵɵFactoryDeclaration<DynamicAnalyticsService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DynamicAnalyticsService>;
}
export {};
