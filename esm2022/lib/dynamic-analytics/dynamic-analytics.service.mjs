import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { of, Subject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common/http";
export var DynamicType;
(function (DynamicType) {
    DynamicType[DynamicType["Simple"] = 0] = "Simple";
    DynamicType[DynamicType["Sequence"] = 1] = "Sequence";
    DynamicType[DynamicType["SequenceEvent"] = 2] = "SequenceEvent";
})(DynamicType || (DynamicType = {}));
export var MiscellaneousEventAction;
(function (MiscellaneousEventAction) {
    MiscellaneousEventAction["Beforeunload"] = "beforeunload";
    MiscellaneousEventAction["Timed"] = "timed"; // Must only be used in a sequence, either to progress the sequence after some time, or to trigger a sequence cancellation event. Not trackable.
})(MiscellaneousEventAction || (MiscellaneousEventAction = {}));
export var MouseEventAction;
(function (MouseEventAction) {
    MouseEventAction["Click"] = "click";
    MouseEventAction["MouseOver"] = "mouseover";
    MouseEventAction["MouseOut"] = "mouseout";
    MouseEventAction["MouseDown"] = "mousedown";
    MouseEventAction["MouseUp"] = "mouseup";
})(MouseEventAction || (MouseEventAction = {}));
export var KeyboardEventAction;
(function (KeyboardEventAction) {
    KeyboardEventAction["KeyPress"] = "keypress";
    KeyboardEventAction["KeyDown"] = "keydown";
    KeyboardEventAction["KeyUp"] = "keyup";
})(KeyboardEventAction || (KeyboardEventAction = {}));
export class DynamicAnalyticsService {
    onEvent = new Subject();
    versionFilterPredicate;
    httpClient;
    eventRecords = [];
    loggingEnabled = false;
    constructor(httpBackend) {
        this.httpClient = new HttpClient(httpBackend);
        this.observer = new MutationObserver(() => this.domChanged$.next());
        /*
        Test cases:
        - Click events / Simple event
    
        - Click X, then Y event / Sequence
        - Mouse-over, then mouse-out without clicking inside event / Sequence with cancel event
        - Click X (to open), then click Y to close without clicking Z events / Sequence with cancel event
    
        - Count number of times event X has been fired this session?
    
        - Window closed event. Use to submit values gathered using sequences, or event totals during a session. "How many times did sequence/event X happen in the session"
        - Hourly/Minutely events to send totals during the last hour/minute
        -
        - Get a specific value from the DOM when firing an event (run arbitrary JS? Or just inspect DOM info?)
        */
        // this.eventConfigDefinition = {
        //   configs: [
        //     {
        //       minVersion: '',
        //       maxVersion: '',
        //       events: [
        //         // Simple click event
        //         {id: 1, dynamicType: DynamicType.SequenceEvent, selector: '.toolbar-container > button', eventType: EventType.Click, message: 'Click ellipsis menu'},
        //         {id: 2, dynamicType: DynamicType.SequenceEvent, selector: '.mat-mdc-menu-content button:nth-child(1)', eventType: EventType.Click, message: 'Click New Operation'},
        //         {id: 3, dynamicType: DynamicType.SequenceEvent, selector: '.mat-mdc-menu-content button:nth-child(2)', eventType: EventType.Click, message: 'Click Location Wizard'},
        //         {id: 4, dynamicType: DynamicType.SequenceEvent, selector: '.cdk-overlay-backdrop', eventType: EventType.Click, message: 'Click anywhere (other than sequence element(s))'},
        //         // {id: 4, dynamicType: DynamicType.SequenceEvent, selector: 'document', eventType: EventType.Click, message: 'Click anywhere (other than sequence element(s))'},
        //         {id: 5, dynamicType: DynamicType.Sequence, message: 'Click rating points icon', sequenceEvents: [1, 3], cancelEvents: [2, 4], isTrackable: true},
        //       ]
        //     }
        //   ]
        // };
        // this.log(JSON.stringify(this.eventConfigDefinition));
    }
    domChanged$ = new Subject();
    observer;
    sequenceTracker = {};
    timedEventForSequenceTracker = {};
    blockedSequenceIds = [];
    filteredEvents = [];
    documentConfigListeners;
    beforeUnloadConfigListeners;
    onDomChanged = _.debounce(() => {
        _.each(this.filteredEvents, dynamicEvent => {
            if (this.isDynamicEventWithSelector(dynamicEvent) && dynamicEvent.selector !== 'document') {
                const elements = document.querySelectorAll(dynamicEvent.selector);
                _.each(elements, element => {
                    if (!this.hasEventListener(element, dynamicEvent)) {
                        this.addEventListener(element, dynamicEvent);
                    }
                });
            }
        });
        this.cleanupEventRecords();
    }, 100);
    initialize(url, versionFilterPredicate) {
        this.versionFilterPredicate = versionFilterPredicate;
        this.initializeAnalyticsConfiguration(url);
        this.initializeMutationObserver();
    }
    initializeWithConfig(eventConfigDefinition, versionFilterPredicate) {
        this.versionFilterPredicate = versionFilterPredicate;
        this.initializeEventConfigDefinition(eventConfigDefinition);
        this.initializeMutationObserver();
    }
    initializeMutationObserver() {
        const rootElement = document.getElementsByTagName('html')[0];
        const mutationObserverConfig = { attributes: false, childList: true, subtree: true };
        this.observer.observe(rootElement, mutationObserverConfig);
    }
    initializeAnalyticsConfiguration(url) {
        this.getConfiguration$(url).subscribe(eventConfigDefinition => this.initializeEventConfigDefinition(eventConfigDefinition));
    }
    initializeEventConfigDefinition(eventConfigDefinition) {
        if (_.isEmpty(eventConfigDefinition?.configs)) {
            console.warn('No analytics configuration found');
            return;
        }
        this.validateEventConfigDefinition(eventConfigDefinition);
        _.each(eventConfigDefinition.configs, config => {
            if (this.versionFilterPredicate(config.minVersion, config.maxVersion)) {
                this.filteredEvents = this.filteredEvents.concat(config.events);
            }
        });
        if (_.isEmpty(this.filteredEvents)) {
            console.warn('No analytics events found for this application version');
            return;
        }
        this.domChanged$.subscribe(() => this.onDomChanged());
        this.onDomChanged();
        const documentConfigs = _.filter(this.filteredEvents, dynamicEvent => this.isDynamicEventWithSelector(dynamicEvent) && dynamicEvent.selector === 'document');
        this.documentConfigListeners = _.map(documentConfigs, dynamicEvent => this.getOnDynamicEventHandler(dynamicEvent));
        document.addEventListener('click', (event) => this.onDocumentClicked(event));
        const beforeUnloadConfigs = _.filter(this.filteredEvents, dynamicEvent => this.isBeforeUnloadEventType(dynamicEvent));
        this.beforeUnloadConfigListeners = _.map(beforeUnloadConfigs, dynamicEvent => this.getOnDynamicEventHandler(dynamicEvent));
        window.addEventListener('beforeunload', () => this.onBeforeUnload());
    }
    ;
    getConfiguration$(url) {
        return this.httpClient
            .get(url)
            .pipe(catchError(error => {
            console.error('Unable to retrieve dynamic analytics configuration');
            console.error(error);
            return of(error);
        }));
    }
    hasEventListener(element, dynamicEvent) {
        const eventRecord = this.getEventRecord(element);
        return eventRecord?.eventsWithHandlers.some(eventWithHandle => eventWithHandle.dynamicEvent === dynamicEvent) ?? false;
    }
    getEventRecord(element) {
        return this.eventRecords.find(entry => entry.element === element);
    }
    cleanupEventRecords() {
        const listenerRecordsToCleanUp = this.eventRecords.filter(record => !document.body.contains(record.element));
        listenerRecordsToCleanUp.forEach(eventRecord => {
            eventRecord.eventsWithHandlers.forEach(({ dynamicEvent, eventHandler }) => {
                eventRecord.element.removeEventListener(dynamicEvent.selector, eventHandler);
            });
        });
        this.eventRecords = _.difference(this.eventRecords, listenerRecordsToCleanUp);
    }
    addEventListener(element, dynamicEvent) {
        let eventHandler = this.getOnDynamicEventHandler(dynamicEvent, element);
        element.addEventListener(dynamicEvent.eventAction, eventHandler);
        let eventRecord = this.getEventRecord(element);
        if (_.isNil(eventRecord)) {
            eventRecord = {
                element,
                eventsWithHandlers: []
            };
            this.eventRecords.push(eventRecord);
        }
        eventRecord.eventsWithHandlers.push({
            dynamicEvent,
            eventHandler
        });
    }
    getOnDynamicEventHandler(dynamicEvent, element) {
        return (event) => {
            if (!_.isNil(element) && this.isDynamicEventWithSelector(dynamicEvent)) {
                const elementsMatchingSelector = document.querySelectorAll(dynamicEvent.statusSelector ?? dynamicEvent.selector);
                const doesElementMatchConfig = _.isNil(dynamicEvent.statusSelector) ? _.find(elementsMatchingSelector, existingElement => existingElement === element) : elementsMatchingSelector.length > 0;
                if (!doesElementMatchConfig) {
                    this.log(`Element no longer matches selector. Cancelling event ${dynamicEvent.id}`);
                    return;
                }
            }
            this.onSimpleOrSequenceEvent(dynamicEvent, event);
        };
    }
    log(text) {
        if (this.loggingEnabled) {
            console.log(text);
        }
    }
    onSimpleOrSequenceEvent(dynamicEvent, event) {
        const isSimpleEvent = this.isSimpleEvent(dynamicEvent);
        if (isSimpleEvent) {
            if (_.isNil(event) || !this.isKeyboardEventType(dynamicEvent) || !dynamicEvent.isAlphaNumeric || this.isAlphaNumericKeyboardEvent(event)) {
                const additionalData = this.getAdditionalEventData(dynamicEvent);
                this.trackEvent(dynamicEvent, additionalData);
            }
        }
        if (isSimpleEvent || this.isSequenceEvent(dynamicEvent)) {
            this.onSequenceEvent(dynamicEvent, event);
        }
    }
    getAdditionalEventData(dynamicEvent) {
        let additionalData;
        if (!_.isNil(dynamicEvent.additionalDataSelector)) {
            const elementWithData = document.querySelector(dynamicEvent.additionalDataSelector);
            if (!_.isNil(elementWithData)) {
                if (elementWithData instanceof HTMLInputElement) {
                    additionalData = elementWithData.value;
                }
                else {
                    additionalData = elementWithData.innerHTML;
                }
            }
        }
        return additionalData;
    }
    isAlphaNumericKeyboardEvent(event) {
        return event?.key.length === 1;
    }
    onDocumentClicked(event) {
        _.each(this.documentConfigListeners, listener => listener(event));
        this.domChanged$.next();
    }
    onBeforeUnload() {
        _.each(this.beforeUnloadConfigListeners, listener => listener());
    }
    formatDynamicEventString(event) {
        const isSimpleEvent = this.isSimpleEvent(event);
        if (isSimpleEvent || this.isSequenceEvent(event)) {
            let logDetails = `${event.id}. ${event.message}`;
            if (!_.isNil(event.selector)) {
                logDetails += `. ${event.selector}`;
            }
            if (isSimpleEvent) {
                return `** Tracking simple event: ${logDetails}`;
            }
            else if (this.isSequenceEvent(event)) {
                return `Sequence event: ${logDetails} ${this.getSequenceProgress(event)}`;
            }
        }
        return `** Tracking sequence: ${event.id}. ${event.message}`;
    }
    getSequenceProgress(dynamicEvent) {
        const sequencesContainingThisEvent = _.filter(this.filteredEvents, filteredDynamicEvent => this.isSequence(filteredDynamicEvent) &&
            _.includes(filteredDynamicEvent.sequenceEvents, dynamicEvent.id));
        const progress = [];
        _.each(sequencesContainingThisEvent, sequence => {
            if (_.includes(this.sequenceTracker[sequence.id], dynamicEvent.id)) {
                progress.push(`Sequence ${sequence.id} = ${this.sequenceTracker[sequence.id].length}/${sequence.sequenceEvents.length}`);
            }
        });
        return progress.join(', ');
    }
    onSequenceEvent(dynamicEvent, event) {
        const sequencesCancelledByThisEvent = _.filter(this.filteredEvents, filteredDynamicEvent => this.isSequence(filteredDynamicEvent) &&
            _.includes(filteredDynamicEvent.cancelEvents, dynamicEvent.id));
        if (!_.isEmpty(sequencesCancelledByThisEvent)) {
            const resetSequences = [];
            _.each(sequencesCancelledByThisEvent, sequence => {
                const tracker = this.sequenceTracker[sequence.id] = this.sequenceTracker[sequence.id] ?? [];
                if (!_.isEmpty(tracker) && _.includes(sequence.cancelEvents, dynamicEvent.id) && !this.doesEventTargetTriggerSequenceEvent(sequence, event)) {
                    resetSequences.push(sequence);
                    this.resetSequence(sequence);
                    this.blockedSequenceIds.push(sequence.id);
                    setTimeout(() => {
                        _.pull(this.blockedSequenceIds, sequence.id);
                    }, 10);
                }
            });
            if (!_.isEmpty(resetSequences)) {
                this.log(`Sequence reset by event ${dynamicEvent.id}: ${resetSequences.map(sequence => sequence.id).join(',')}`);
            }
        }
        const sequencesContainingThisEvent = _.filter(this.filteredEvents, filteredDynamicEvent => {
            return this.isSequence(filteredDynamicEvent) &&
                _.includes(filteredDynamicEvent.sequenceEvents, dynamicEvent.id) &&
                !_.includes(this.blockedSequenceIds, filteredDynamicEvent.id);
        });
        console.log(`sequencesContainingThisEvent: ${sequencesContainingThisEvent.map(s => s.id).join(', ')}`);
        _.each(sequencesContainingThisEvent, sequence => {
            setTimeout(() => {
                _.pull(this.blockedSequenceIds, sequence.id);
            }, 10);
            const tracker = this.sequenceTracker[sequence.id] = this.sequenceTracker[sequence.id] ?? [];
            if (sequence.sequenceEvents[tracker.length] === dynamicEvent.id) {
                this.log(`Adding event ${dynamicEvent.id} to Sequence ${sequence.id} tracker`);
                tracker.push(dynamicEvent.id);
                this.blockedSequenceIds.push(sequence.id);
                // this.logEvent(dynamicEvent);
            }
            if (tracker.length === sequence.sequenceEvents.length) {
                this.log(`Sequence ${sequence.id} complete`);
                this.trackAndResetSequence(sequence);
                this.onSequenceEvent(sequence);
            }
            else {
                const nextEventIdInSequence = sequence.sequenceEvents[tracker.length];
                const nextEventInSequence = _.find(this.filteredEvents, { id: nextEventIdInSequence });
                if (_.isNil(nextEventInSequence)) {
                    throw new Error(`Error: Next event in sequence not found. Incorrect Id specified? Next event id ${nextEventIdInSequence}. Sequence ${sequence.id}`);
                }
                if (this.isTimedEvent(nextEventInSequence)) {
                    this.startTimedEventTimerForSequence(nextEventInSequence, sequence);
                }
            }
        });
    }
    startTimedEventTimerForSequence(dynamicEvent, sequence) {
        const timer = dynamicEvent.timeout;
        if (timer > 0) {
            const tracker = this.timedEventForSequenceTracker[sequence.id] = this.timedEventForSequenceTracker[sequence.id] ?? {};
            if (!_.isNil(tracker[dynamicEvent.id])) {
                throw new Error(`Timer event already exists for event ${dynamicEvent.id} in sequence ${sequence.id}`);
            }
            this.log(`Timer starting for event ${dynamicEvent.id} in sequence ${sequence.id}`);
            tracker[dynamicEvent.id] = setTimeout(() => {
                delete tracker[dynamicEvent.id];
                this.log(`Timer complete for event ${dynamicEvent.id} in sequence ${sequence.id}`);
                this.onSimpleOrSequenceEvent(dynamicEvent);
            }, timer);
        }
        else {
            throw new Error(`Timeout value must be greater than 0 for event ${dynamicEvent.id}`);
        }
    }
    resetTimersForSequence(sequence) {
        const tracker = this.timedEventForSequenceTracker[sequence.id];
        if (!_.isNil(tracker)) {
            _.each(tracker, timeoutId => clearTimeout(timeoutId));
        }
        delete this.timedEventForSequenceTracker[sequence.id];
    }
    resetSequence(sequence) {
        this.sequenceTracker[sequence.id] = [];
        this.resetTimersForSequence(sequence);
        this.log(`Cancelling sequence: ${sequence.id}. Message: ${sequence.message}`);
    }
    trackAndResetSequence(sequence) {
        this.resetSequence(sequence);
        if (sequence.isTrackable) {
            const additionalData = this.getAdditionalEventData(sequence);
            this.trackEvent(sequence, additionalData);
        }
    }
    trackEvent(event, additionalData) {
        this.logEvent(event);
        this.onEvent.next({
            ...event,
            additionalData
        });
    }
    logEvent(event) {
        if (this.isSequence(event) && !event.isTrackable) {
            return;
        }
        this.log(this.formatDynamicEventString(event));
    }
    isSequenceEvent(event) {
        return event.dynamicType === DynamicType.SequenceEvent;
    }
    isSimpleEvent(event) {
        return event.dynamicType === DynamicType.Simple;
    }
    isDynamicEventWithEventType(event) {
        return (this.isSimpleEvent(event) || this.isSequenceEvent(event));
    }
    isBeforeUnloadEventType(event) {
        return (this.isSimpleEvent(event) || this.isSequenceEvent(event)) && event.eventAction === MiscellaneousEventAction.Beforeunload;
    }
    isKeyboardEventType(event) {
        return (this.isSimpleEvent(event) || this.isSequenceEvent(event)) && event.eventAction in KeyboardEventAction;
    }
    isDynamicEventWithSelector(event) {
        return (this.isSimpleEvent(event) || this.isSequenceEvent(event)) && event.selector !== undefined;
    }
    isSequence(event) {
        return event.dynamicType === DynamicType.Sequence;
    }
    isTimedEvent(event) {
        return this.isDynamicEventWithEventType(event) && event.eventAction === MiscellaneousEventAction.Timed;
    }
    doesEventTargetTriggerSequenceEvent(sequence, event) {
        if (_.isNil(event)) {
            return false;
        }
        const tracker = this.sequenceTracker[sequence.id];
        if (_.isEmpty(tracker)) {
            return;
        }
        const otherSequenceEventId = sequence.sequenceEvents[tracker.length - 1];
        const sequenceEvent = _.find(this.filteredEvents, dynamicEvent => dynamicEvent.id === otherSequenceEventId);
        if (!this.isDynamicEventWithSelector(sequenceEvent)) {
            return;
        }
        const elementsMatchingSelector = document.querySelectorAll(sequenceEvent.statusSelector ?? sequenceEvent.selector);
        const target = event.target;
        const isEventTargetWithinAnyMatchedElements = _.some(elementsMatchingSelector, element => element === target || element.contains(target));
        return isEventTargetWithinAnyMatchedElements;
    }
    validateEventConfigDefinition(eventConfigDefinition) {
        const uniqueEventIds = new Set();
        const uniqueSequenceEventIds = new Set();
        const uniqueCancelEventIds = new Set();
        _.each(eventConfigDefinition.configs, config => {
            if (!this.versionFilterPredicate(config.minVersion, config.maxVersion)) {
                return; // Skipping. Config doesn't apply to this version. Duplicate events etc. don't matter if a config is unused.
            }
            _.each(config.events, event => {
                if (uniqueEventIds.has(event.id)) {
                    throw new Error('Event ids must be unique');
                }
                uniqueEventIds.add(event.id);
                if (this.isSequence(event)) {
                    if (event.sequenceEvents.length < 2) {
                        throw new Error('Sequences must have at least 2 event ids');
                    }
                    event.sequenceEvents.forEach(id => {
                        if (id === event.id) {
                            throw new Error('Sequences cannot reference their own id as a sequence event');
                        }
                        uniqueSequenceEventIds.add(id);
                    });
                    event.cancelEvents.forEach(id => {
                        if (id === event.id) {
                            throw new Error('Sequences cannot reference their own id as a cancel event');
                        }
                        uniqueCancelEventIds.add(id);
                    });
                }
                if (this.isTimedEvent(event) && (event.timeout <= 0 || _.isNaN(event.timeout))) {
                    throw new Error('Timeout event must be a number greater than zero');
                }
                if (!_.isNil(event.additionalData)) {
                    throw new Error('Additional data must not be provided in the configuration. Use the `additionalDataSelector` to allow the service to find additional data in the DOM at event-time');
                }
            });
        });
        uniqueSequenceEventIds.forEach(id => {
            if (!uniqueEventIds.has(id)) {
                throw new Error('Sequence events must exist');
            }
        });
        uniqueCancelEventIds.forEach(id => {
            if (!uniqueEventIds.has(id)) {
                throw new Error('Cancel events must exist');
            }
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "18.1.2", ngImport: i0, type: DynamicAnalyticsService, deps: [{ token: i1.HttpBackend }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "18.1.2", ngImport: i0, type: DynamicAnalyticsService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "18.1.2", ngImport: i0, type: DynamicAnalyticsService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: () => [{ type: i1.HttpBackend }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1pYy1hbmFseXRpY3Muc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL2R5bmFtaWMtYW5hbHl0aWNzL3NyYy9saWIvZHluYW1pYy1hbmFseXRpY3MvZHluYW1pYy1hbmFseXRpY3Muc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQWUsVUFBVSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUMzQyxPQUFPLEtBQUssQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUNuQyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7OztBQXdCNUMsTUFBTSxDQUFOLElBQVksV0FJWDtBQUpELFdBQVksV0FBVztJQUNyQixpREFBTSxDQUFBO0lBQ04scURBQVEsQ0FBQTtJQUNSLCtEQUFhLENBQUE7QUFDZixDQUFDLEVBSlcsV0FBVyxLQUFYLFdBQVcsUUFJdEI7QUFFRCxNQUFNLENBQU4sSUFBWSx3QkFHWDtBQUhELFdBQVksd0JBQXdCO0lBQ2xDLHlEQUE2QixDQUFBO0lBQzdCLDJDQUFlLENBQUEsQ0FBQyxnSkFBZ0o7QUFDbEssQ0FBQyxFQUhXLHdCQUF3QixLQUF4Qix3QkFBd0IsUUFHbkM7QUFFRCxNQUFNLENBQU4sSUFBWSxnQkFNWDtBQU5ELFdBQVksZ0JBQWdCO0lBQzFCLG1DQUFlLENBQUE7SUFDZiwyQ0FBdUIsQ0FBQTtJQUN2Qix5Q0FBcUIsQ0FBQTtJQUNyQiwyQ0FBdUIsQ0FBQTtJQUN2Qix1Q0FBbUIsQ0FBQTtBQUNyQixDQUFDLEVBTlcsZ0JBQWdCLEtBQWhCLGdCQUFnQixRQU0zQjtBQUVELE1BQU0sQ0FBTixJQUFZLG1CQUlYO0FBSkQsV0FBWSxtQkFBbUI7SUFDN0IsNENB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O1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO3VHQXZlVSx1QkFBdUI7MkdBQXZCLHVCQUF1QixjQUZ0QixNQUFNOzsyRkFFUCx1QkFBdUI7a0JBSG5DLFVBQVU7bUJBQUM7b0JBQ1YsVUFBVSxFQUFFLE1BQU07aUJBQ25CIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSHR0cEJhY2tlbmQsIEh0dHBDbGllbnQgfSBmcm9tICdAYW5ndWxhci9jb21tb24vaHR0cCc7XHJcbmltcG9ydCB7IEluamVjdGFibGUgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0ICogYXMgXyBmcm9tICdsb2Rhc2gnO1xyXG5pbXBvcnQgeyBvZiwgU3ViamVjdCB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBjYXRjaEVycm9yIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xyXG5cclxuXHJcbnR5cGUgVmVyc2lvblBhcmFtZXRlciA9IHN0cmluZyB8IG51bWJlciB8IHVuZGVmaW5lZDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSUV2ZW50Q29uZmlnIHtcclxuICBtaW5WZXJzaW9uOiBWZXJzaW9uUGFyYW1ldGVyOyAvLyBVc2VkICh3aXRoIG1heFZlcnNpb24pIHRvIHN1cHBvcnQgbXVsdGlwbGUgdmVyc2lvbnMgb2YgYSBkZXBsb3llZCBhcHBsaWNhdGlvbiB3aXRoIHRoZSBzYW1lIGNvbmZpZywgYW5kIGVuc3VyZSB3ZSBvbmx5IHRyYWNrIHdoYXQgd2Ugd2FudCwgd2hlbiB3ZSB3YW50IGl0LCBhbmQgaW4gd2hpY2ggdmVyc2lvbnMgb2YgdGhlIGFwcGxpY2F0aW9uLlxyXG4gIG1heFZlcnNpb246IFZlcnNpb25QYXJhbWV0ZXI7XHJcbiAgZXZlbnRzOiBEeW5hbWljRXZlbnRbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJRXZlbnRDb25maWdEZWZpbml0aW9uIHtcclxuICBjb25maWdzOiBJRXZlbnRDb25maWdbXTtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgRHluYW1pY0V2ZW50ID1cclxuICBJRHluYW1pY0V2ZW50V2l0aEV2ZW50QWN0aW9uIHxcclxuICBJRHluYW1pY0V2ZW50V2l0aFNlbGVjdG9yIHxcclxuICBJVGltZWRFdmVudCB8XHJcbiAgSU1vdXNlRXZlbnQgfFxyXG4gIElLZXlib2FyZEV2ZW50IHxcclxuICBJQmVmb3JlVW5sb2FkRXZlbnQgfFxyXG4gIElTZXF1ZW5jZTtcclxuXHJcbmV4cG9ydCBlbnVtIER5bmFtaWNUeXBlIHtcclxuICBTaW1wbGUsIC8vIFN0YW5kYWxvbmUgZXZlbnRzLiBUcmFja2FibGUuXHJcbiAgU2VxdWVuY2UsIC8vIENvbXBsZXggZXZlbnRzLiBUcmlnZ2VyIG11bHRpcGxlIFwiU2VxdWVuY2VFdmVudHNcIiBmaXJzdCB0byB0cmlnZ2VyIGEgXCJTZXF1ZW5jZVwiLiBTZXF1ZW5jZXMgbWF5IGFsc28gYmUgdXNlZCB0byB0cmlnZ2VyIG90aGVyIHNlcXVlbmNlcy4gVHJhY2thYmxlIChvcHRpb25hbCkuXHJcbiAgU2VxdWVuY2VFdmVudCwgLy8gU2ltaWxhciB0byBhIFwiU2ltcGxlXCIgZXZlbnQgYnV0IHVzZWQgYXMgb25lIHN0ZXAgb2YgYSBcIlNlcXVlbmNlXCIuIE1heSBvcHRpb25hbGx5IGZpcmUgYW4gYW5hbHl0aWNzIGV2ZW50IHdoZW4gdHJpZ2dlcmVkLiBOb3QgdHJhY2thYmxlLlxyXG59XHJcblxyXG5leHBvcnQgZW51bSBNaXNjZWxsYW5lb3VzRXZlbnRBY3Rpb24ge1xyXG4gIEJlZm9yZXVubG9hZCA9ICdiZWZvcmV1bmxvYWQnLCAvLyBDYW4gYmUgdXNlZCB0byBmaW5hbGl6ZSBhIHNlcXVlbmNlLiBlLmcuIFwiRmlyZSBhbiBldmVudCB3aGVuIHRoZSB1c2VyIGJlZ2lucyB0byBjcmVhdGUgc29tZSBuZXcgZGF0YSwgYnV0IGNsb3NlcyB0aGUgYnJvd3NlciB3aXRob3V0IHNhdmluZyB0aGVpciBjaGFuZ2VzXCIuIFRyYWNrYWJsZS5cclxuICBUaW1lZCA9ICd0aW1lZCcgLy8gTXVzdCBvbmx5IGJlIHVzZWQgaW4gYSBzZXF1ZW5jZSwgZWl0aGVyIHRvIHByb2dyZXNzIHRoZSBzZXF1ZW5jZSBhZnRlciBzb21lIHRpbWUsIG9yIHRvIHRyaWdnZXIgYSBzZXF1ZW5jZSBjYW5jZWxsYXRpb24gZXZlbnQuIE5vdCB0cmFja2FibGUuXHJcbn1cclxuXHJcbmV4cG9ydCBlbnVtIE1vdXNlRXZlbnRBY3Rpb24ge1xyXG4gIENsaWNrID0gJ2NsaWNrJyxcclxuICBNb3VzZU92ZXIgPSAnbW91c2VvdmVyJyxcclxuICBNb3VzZU91dCA9ICdtb3VzZW91dCcsXHJcbiAgTW91c2VEb3duID0gJ21vdXNlZG93bicsXHJcbiAgTW91c2VVcCA9ICdtb3VzZXVwJyxcclxufVxyXG5cclxuZXhwb3J0IGVudW0gS2V5Ym9hcmRFdmVudEFjdGlvbiB7XHJcbiAgS2V5UHJlc3MgPSAna2V5cHJlc3MnLFxyXG4gIEtleURvd24gPSAna2V5ZG93bicsXHJcbiAgS2V5VXAgPSAna2V5dXAnLFxyXG59XHJcblxyXG5leHBvcnQgdHlwZSBFdmVudEFjdGlvbiA9XHJcbiAgTWlzY2VsbGFuZW91c0V2ZW50QWN0aW9uIHxcclxuICBNb3VzZUV2ZW50QWN0aW9uIHxcclxuICBLZXlib2FyZEV2ZW50QWN0aW9uXHJcblxyXG5pbnRlcmZhY2UgSUR5bmFtaWNFdmVudEJhc2Uge1xyXG4gIGlkOiBudW1iZXI7XHJcbiAgZHluYW1pY1R5cGU6IER5bmFtaWNUeXBlO1xyXG4gIG1lc3NhZ2U6IHN0cmluZztcclxuICBhZGRpdGlvbmFsRGF0YVNlbGVjdG9yPzogc3RyaW5nOyAvLyBPcHRpb25hbC4gVXNlZCB0byBmZXRjaCBhZGRpdGlvbmFsIGRhdGEgZnJvbSB0aGUgRE9NLiBXaWxsIGF0dGVtcHQgdG8gZ3JhYiBhbiBpbnB1dCB2YWx1ZSBpZiBwb3NzaWJsZS5cclxuICBhZGRpdGlvbmFsRGF0YT86IHN0cmluZzsgLy8gRG8gbm90IGluY2x1ZGUgd2l0aCBldmVudCBjb25maWcuIFRoaXMgd2lsbCBiZSBmaWxsZWQgaW4gd2hlbiB0aGUgZXZlbnQgZmlyZXMsIGlmIHRoZSBhZGRpdGlvbmFsRGF0YVNlbGVjdG9yIGlzIGRlZmluZWQgYW5kIGV2YWx1YXRlcyB0byBhbnl0aGluZy5cclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJRHluYW1pY0V2ZW50V2l0aEV2ZW50QWN0aW9uIGV4dGVuZHMgSUR5bmFtaWNFdmVudEJhc2Uge1xyXG4gIGV2ZW50QWN0aW9uOiBFdmVudEFjdGlvbjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJRHluYW1pY0V2ZW50V2l0aFNlbGVjdG9yIGV4dGVuZHMgSUR5bmFtaWNFdmVudFdpdGhFdmVudEFjdGlvbiB7XHJcbiAgc2VsZWN0b3I6IHN0cmluZzsgLy8gRE9NL0NTUyBzZWxlY3RvciB1c2VkIHRvIHRyaWdnZXIgdGhlIGV2ZW50XHJcbiAgc3RhdHVzU2VsZWN0b3I/OiBzdHJpbmc7IC8vIE9wdGlvbmFsLiBVc2VkIHRvIGRldGVybWluZSwgYXQgZXZlbnQgdGltZSwgd2hldGhlciB0aGUgZXZlbnQgaXMgdmFsaWQuIGUuZy4gXCJGaXJlIGV2ZW50IFggYnkgY2xpY2tpbmcgb24gYnV0dG9uIFksIGJ1dCBvbmx5IGlmIGVsZW1lbnQgWiBpcyB2aXNpYmxlIGFuZCBlbmFibGVkXCJcclxufVxyXG5cclxuaW50ZXJmYWNlIElTaW1wbGVFdmVudCBleHRlbmRzIElEeW5hbWljRXZlbnRXaXRoU2VsZWN0b3Ige1xyXG4gIGR5bmFtaWNUeXBlOiBEeW5hbWljVHlwZS5TaW1wbGU7XHJcbn1cclxuXHJcbmludGVyZmFjZSBJU2VxdWVuY2VFdmVudCBleHRlbmRzIElEeW5hbWljRXZlbnRXaXRoU2VsZWN0b3Ige1xyXG4gIGR5bmFtaWNUeXBlOiBEeW5hbWljVHlwZS5TZXF1ZW5jZUV2ZW50O1xyXG4gIGFkZGl0aW9uYWxEYXRhU2VsZWN0b3I6IHVuZGVmaW5lZDsgLy8gU2VxdWVuY2UgZXZlbnRzIGFyZSBub3QgdHJhY2tlZC5cclxufVxyXG5cclxuaW50ZXJmYWNlIElUaW1lZEV2ZW50IGV4dGVuZHMgSUR5bmFtaWNFdmVudFdpdGhFdmVudEFjdGlvbiB7XHJcbiAgZHluYW1pY1R5cGU6IER5bmFtaWNUeXBlLlNlcXVlbmNlRXZlbnQgfCBEeW5hbWljVHlwZS5TaW1wbGU7XHJcbiAgZXZlbnRBY3Rpb246IE1pc2NlbGxhbmVvdXNFdmVudEFjdGlvbi5UaW1lZDtcclxuICBzZWxlY3RvcjogdW5kZWZpbmVkO1xyXG4gIHRpbWVvdXQ6IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIElNb3VzZUV2ZW50IGV4dGVuZHMgSUR5bmFtaWNFdmVudFdpdGhFdmVudEFjdGlvbiB7XHJcbiAgZHluYW1pY1R5cGU6IER5bmFtaWNUeXBlLlNlcXVlbmNlRXZlbnQgfCBEeW5hbWljVHlwZS5TaW1wbGU7XHJcbiAgZXZlbnRBY3Rpb246IE1vdXNlRXZlbnRBY3Rpb247XHJcbiAgc2VsZWN0b3I6IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIElLZXlib2FyZEV2ZW50IGV4dGVuZHMgSUR5bmFtaWNFdmVudFdpdGhFdmVudEFjdGlvbiB7XHJcbiAgZHluYW1pY1R5cGU6IER5bmFtaWNUeXBlLlNlcXVlbmNlRXZlbnQgfCBEeW5hbWljVHlwZS5TaW1wbGU7XHJcbiAgZXZlbnRBY3Rpb246IEtleWJvYXJkRXZlbnRBY3Rpb247XHJcbiAgc2VsZWN0b3I6IHN0cmluZztcclxuICBpc0FscGhhTnVtZXJpYzogYm9vbGVhbjtcclxufVxyXG5cclxuaW50ZXJmYWNlIElCZWZvcmVVbmxvYWRFdmVudCBleHRlbmRzIElEeW5hbWljRXZlbnRXaXRoRXZlbnRBY3Rpb24ge1xyXG4gIGR5bmFtaWNUeXBlOiBEeW5hbWljVHlwZS5TZXF1ZW5jZUV2ZW50IHwgRHluYW1pY1R5cGUuU2ltcGxlO1xyXG4gIGV2ZW50QWN0aW9uOiBNaXNjZWxsYW5lb3VzRXZlbnRBY3Rpb24uQmVmb3JldW5sb2FkO1xyXG4gIHNlbGVjdG9yOiBzdHJpbmc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBJU2VxdWVuY2UgZXh0ZW5kcyBJRHluYW1pY0V2ZW50QmFzZSB7XHJcbiAgZHluYW1pY1R5cGU6IER5bmFtaWNUeXBlLlNlcXVlbmNlO1xyXG4gIHNlcXVlbmNlRXZlbnRzOiBudW1iZXJbXTsgLy8gSWRzIGNvcnJlc3BvbmRpbmcgdG8gZXZlbnRzIHRoYXQgY29udGludWUgYSBzZXF1ZW5jZS5cclxuICBjYW5jZWxFdmVudHM6IG51bWJlcltdOyAvLyBJZHMgY29ycmVzcG9uZGluZyB0byBldmVudHMgdGhhdCB3aWxsIHRyaWdnZXIgdGhlIGNhbmNlbGxhdGlvbiBvZiBhIHNlcXVlbmNlLlxyXG4gIGlzVHJhY2thYmxlOiBib29sZWFuOyAvLyBTZXF1ZW5jZXMgYXJlIGludGVuZGVkIHRvIGNoYWluIHRvZ2V0aGVyIG90aGVyIGV2ZW50cyBvciBzZXF1ZW5jZXMuIFdoZXRoZXIgdGhlIGNvbXBsZXRpb24gb2YgYSBzZXF1ZW5jZSBpdHNlbGYgaXNUcmFja2FibGUgb3Igbm90IGlzIG9wdGlvbmFsLiBJZiB0aGlzIGlzIHNldCB0byBmYWxzZSwgdGhlIHNlcXVlbmNlIHNob3VsZCBjb250YWluIGF0IGxlYXN0IDEgc2ltcGxlIGV2ZW50IG9yIGNoYWluIHdpdGggYW5vdGhlciwgdHJhY2thYmxlIHNlcXVlbmNlLlxyXG59XHJcblxyXG5pbnRlcmZhY2UgSUR5bmFtaWNFdmVudFdpdGhIYW5kbGVyIHtcclxuICBkeW5hbWljRXZlbnQ6IElEeW5hbWljRXZlbnRXaXRoU2VsZWN0b3I7XHJcbiAgZXZlbnRIYW5kbGVyOiAoZXZlbnQ/OiBFdmVudCkgPT4gdm9pZDtcclxufVxyXG5cclxuaW50ZXJmYWNlIElFdmVudFJlY29yZCB7XHJcbiAgZWxlbWVudDogRWxlbWVudCxcclxuICBldmVudHNXaXRoSGFuZGxlcnM6IElEeW5hbWljRXZlbnRXaXRoSGFuZGxlcltdXHJcbn1cclxuXHJcbkBJbmplY3RhYmxlKHtcclxuICBwcm92aWRlZEluOiAncm9vdCdcclxufSlcclxuZXhwb3J0IGNsYXNzIER5bmFtaWNBbmFseXRpY3NTZXJ2aWNlIHtcclxuICByZWFkb25seSBvbkV2ZW50ID0gbmV3IFN1YmplY3Q8RHluYW1pY0V2ZW50PigpO1xyXG4gIHByaXZhdGUgdmVyc2lvbkZpbHRlclByZWRpY2F0ZSE6IChtaW5WZXJzaW9uOiBWZXJzaW9uUGFyYW1ldGVyLCBtYXhWZXJzaW9uOiBWZXJzaW9uUGFyYW1ldGVyKSA9PiBib29sZWFuO1xyXG4gIHByaXZhdGUgaHR0cENsaWVudDogSHR0cENsaWVudDtcclxuICBwcml2YXRlIGV2ZW50UmVjb3JkczogSUV2ZW50UmVjb3JkW10gPSBbXTtcclxuICBsb2dnaW5nRW5hYmxlZCA9IGZhbHNlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihodHRwQmFja2VuZDogSHR0cEJhY2tlbmQpIHtcclxuICAgIHRoaXMuaHR0cENsaWVudCA9IG5ldyBIdHRwQ2xpZW50KGh0dHBCYWNrZW5kKTtcclxuICAgIHRoaXMub2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB0aGlzLmRvbUNoYW5nZWQkLm5leHQoKSk7XHJcblxyXG4gICAgLypcclxuICAgIFRlc3QgY2FzZXM6XHJcbiAgICAtIENsaWNrIGV2ZW50cyAvIFNpbXBsZSBldmVudFxyXG5cclxuICAgIC0gQ2xpY2sgWCwgdGhlbiBZIGV2ZW50IC8gU2VxdWVuY2VcclxuICAgIC0gTW91c2Utb3ZlciwgdGhlbiBtb3VzZS1vdXQgd2l0aG91dCBjbGlja2luZyBpbnNpZGUgZXZlbnQgLyBTZXF1ZW5jZSB3aXRoIGNhbmNlbCBldmVudFxyXG4gICAgLSBDbGljayBYICh0byBvcGVuKSwgdGhlbiBjbGljayBZIHRvIGNsb3NlIHdpdGhvdXQgY2xpY2tpbmcgWiBldmVudHMgLyBTZXF1ZW5jZSB3aXRoIGNhbmNlbCBldmVudFxyXG5cclxuICAgIC0gQ291bnQgbnVtYmVyIG9mIHRpbWVzIGV2ZW50IFggaGFzIGJlZW4gZmlyZWQgdGhpcyBzZXNzaW9uP1xyXG5cclxuICAgIC0gV2luZG93IGNsb3NlZCBldmVudC4gVXNlIHRvIHN1Ym1pdCB2YWx1ZXMgZ2F0aGVyZWQgdXNpbmcgc2VxdWVuY2VzLCBvciBldmVudCB0b3RhbHMgZHVyaW5nIGEgc2Vzc2lvbi4gXCJIb3cgbWFueSB0aW1lcyBkaWQgc2VxdWVuY2UvZXZlbnQgWCBoYXBwZW4gaW4gdGhlIHNlc3Npb25cIlxyXG4gICAgLSBIb3VybHkvTWludXRlbHkgZXZlbnRzIHRvIHNlbmQgdG90YWxzIGR1cmluZyB0aGUgbGFzdCBob3VyL21pbnV0ZVxyXG4gICAgLVxyXG4gICAgLSBHZXQgYSBzcGVjaWZpYyB2YWx1ZSBmcm9tIHRoZSBET00gd2hlbiBmaXJpbmcgYW4gZXZlbnQgKHJ1biBhcmJpdHJhcnkgSlM/IE9yIGp1c3QgaW5zcGVjdCBET00gaW5mbz8pXHJcbiAgICAqL1xyXG5cclxuICAgIC8vIHRoaXMuZXZlbnRDb25maWdEZWZpbml0aW9uID0ge1xyXG4gICAgLy8gICBjb25maWdzOiBbXHJcbiAgICAvLyAgICAge1xyXG4gICAgLy8gICAgICAgbWluVmVyc2lvbjogJycsXHJcbiAgICAvLyAgICAgICBtYXhWZXJzaW9uOiAnJyxcclxuICAgIC8vICAgICAgIGV2ZW50czogW1xyXG4gICAgLy8gICAgICAgICAvLyBTaW1wbGUgY2xpY2sgZXZlbnRcclxuICAgIC8vICAgICAgICAge2lkOiAxLCBkeW5hbWljVHlwZTogRHluYW1pY1R5cGUuU2VxdWVuY2VFdmVudCwgc2VsZWN0b3I6ICcudG9vbGJhci1jb250YWluZXIgPiBidXR0b24nLCBldmVudFR5cGU6IEV2ZW50VHlwZS5DbGljaywgbWVzc2FnZTogJ0NsaWNrIGVsbGlwc2lzIG1lbnUnfSxcclxuICAgIC8vICAgICAgICAge2lkOiAyLCBkeW5hbWljVHlwZTogRHluYW1pY1R5cGUuU2VxdWVuY2VFdmVudCwgc2VsZWN0b3I6ICcubWF0LW1kYy1tZW51LWNvbnRlbnQgYnV0dG9uOm50aC1jaGlsZCgxKScsIGV2ZW50VHlwZTogRXZlbnRUeXBlLkNsaWNrLCBtZXNzYWdlOiAnQ2xpY2sgTmV3IE9wZXJhdGlvbid9LFxyXG4gICAgLy8gICAgICAgICB7aWQ6IDMsIGR5bmFtaWNUeXBlOiBEeW5hbWljVHlwZS5TZXF1ZW5jZUV2ZW50LCBzZWxlY3RvcjogJy5tYXQtbWRjLW1lbnUtY29udGVudCBidXR0b246bnRoLWNoaWxkKDIpJywgZXZlbnRUeXBlOiBFdmVudFR5cGUuQ2xpY2ssIG1lc3NhZ2U6ICdDbGljayBMb2NhdGlvbiBXaXphcmQnfSxcclxuICAgIC8vICAgICAgICAge2lkOiA0LCBkeW5hbWljVHlwZTogRHluYW1pY1R5cGUuU2VxdWVuY2VFdmVudCwgc2VsZWN0b3I6ICcuY2RrLW92ZXJsYXktYmFja2Ryb3AnLCBldmVudFR5cGU6IEV2ZW50VHlwZS5DbGljaywgbWVzc2FnZTogJ0NsaWNrIGFueXdoZXJlIChvdGhlciB0aGFuIHNlcXVlbmNlIGVsZW1lbnQocykpJ30sXHJcbiAgICAvLyAgICAgICAgIC8vIHtpZDogNCwgZHluYW1pY1R5cGU6IER5bmFtaWNUeXBlLlNlcXVlbmNlRXZlbnQsIHNlbGVjdG9yOiAnZG9jdW1lbnQnLCBldmVudFR5cGU6IEV2ZW50VHlwZS5DbGljaywgbWVzc2FnZTogJ0NsaWNrIGFueXdoZXJlIChvdGhlciB0aGFuIHNlcXVlbmNlIGVsZW1lbnQocykpJ30sXHJcbiAgICAvLyAgICAgICAgIHtpZDogNSwgZHluYW1pY1R5cGU6IER5bmFtaWNUeXBlLlNlcXVlbmNlLCBtZXNzYWdlOiAnQ2xpY2sgcmF0aW5nIHBvaW50cyBpY29uJywgc2VxdWVuY2VFdmVudHM6IFsxLCAzXSwgY2FuY2VsRXZlbnRzOiBbMiwgNF0sIGlzVHJhY2thYmxlOiB0cnVlfSxcclxuICAgIC8vICAgICAgIF1cclxuICAgIC8vICAgICB9XHJcbiAgICAvLyAgIF1cclxuICAgIC8vIH07XHJcbiAgICAvLyB0aGlzLmxvZyhKU09OLnN0cmluZ2lmeSh0aGlzLmV2ZW50Q29uZmlnRGVmaW5pdGlvbikpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWFkb25seSBkb21DaGFuZ2VkJCA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlcjtcclxuICBwcml2YXRlIHJlYWRvbmx5IHNlcXVlbmNlVHJhY2tlcjogYW55ID0ge307XHJcbiAgcHJpdmF0ZSByZWFkb25seSB0aW1lZEV2ZW50Rm9yU2VxdWVuY2VUcmFja2VyOiBhbnkgPSB7fTtcclxuICBwcml2YXRlIHJlYWRvbmx5IGJsb2NrZWRTZXF1ZW5jZUlkczogbnVtYmVyW10gPSBbXTtcclxuICBwcml2YXRlIGZpbHRlcmVkRXZlbnRzOiBEeW5hbWljRXZlbnRbXSA9IFtdO1xyXG4gIHByaXZhdGUgZG9jdW1lbnRDb25maWdMaXN0ZW5lcnMhOiBGdW5jdGlvbltdO1xyXG4gIHByaXZhdGUgYmVmb3JlVW5sb2FkQ29uZmlnTGlzdGVuZXJzITogRnVuY3Rpb25bXTtcclxuXHJcbiAgcHJpdmF0ZSBvbkRvbUNoYW5nZWQgPSBfLmRlYm91bmNlKCgpID0+IHtcclxuICAgIF8uZWFjaCh0aGlzLmZpbHRlcmVkRXZlbnRzLCBkeW5hbWljRXZlbnQgPT4ge1xyXG4gICAgICBpZiAodGhpcy5pc0R5bmFtaWNFdmVudFdpdGhTZWxlY3RvcihkeW5hbWljRXZlbnQpICYmIGR5bmFtaWNFdmVudC5zZWxlY3RvciAhPT0gJ2RvY3VtZW50Jykge1xyXG4gICAgICAgIGNvbnN0IGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChkeW5hbWljRXZlbnQuc2VsZWN0b3IpO1xyXG4gICAgICAgIF8uZWFjaChlbGVtZW50cywgZWxlbWVudCA9PiB7XHJcbiAgICAgICAgICBpZiAoIXRoaXMuaGFzRXZlbnRMaXN0ZW5lcihlbGVtZW50LCBkeW5hbWljRXZlbnQpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcihlbGVtZW50LCBkeW5hbWljRXZlbnQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHRoaXMuY2xlYW51cEV2ZW50UmVjb3JkcygpO1xyXG4gIH0sIDEwMCk7XHJcblxyXG4gIGluaXRpYWxpemUodXJsOiBzdHJpbmcsIHZlcnNpb25GaWx0ZXJQcmVkaWNhdGU6IChtaW5WZXJzaW9uOiBWZXJzaW9uUGFyYW1ldGVyLCBtYXhWZXJzaW9uOiBWZXJzaW9uUGFyYW1ldGVyKSA9PiBib29sZWFuKSB7XHJcbiAgICB0aGlzLnZlcnNpb25GaWx0ZXJQcmVkaWNhdGUgPSB2ZXJzaW9uRmlsdGVyUHJlZGljYXRlO1xyXG4gICAgdGhpcy5pbml0aWFsaXplQW5hbHl0aWNzQ29uZmlndXJhdGlvbih1cmwpO1xyXG4gICAgdGhpcy5pbml0aWFsaXplTXV0YXRpb25PYnNlcnZlcigpO1xyXG4gIH1cclxuXHJcbiAgaW5pdGlhbGl6ZVdpdGhDb25maWcoZXZlbnRDb25maWdEZWZpbml0aW9uOiBJRXZlbnRDb25maWdEZWZpbml0aW9uLCB2ZXJzaW9uRmlsdGVyUHJlZGljYXRlOiAobWluVmVyc2lvbjogVmVyc2lvblBhcmFtZXRlciwgbWF4VmVyc2lvbjogVmVyc2lvblBhcmFtZXRlcikgPT4gYm9vbGVhbikge1xyXG4gICAgdGhpcy52ZXJzaW9uRmlsdGVyUHJlZGljYXRlID0gdmVyc2lvbkZpbHRlclByZWRpY2F0ZTtcclxuICAgIHRoaXMuaW5pdGlhbGl6ZUV2ZW50Q29uZmlnRGVmaW5pdGlvbihldmVudENvbmZpZ0RlZmluaXRpb24pO1xyXG4gICAgdGhpcy5pbml0aWFsaXplTXV0YXRpb25PYnNlcnZlcigpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplTXV0YXRpb25PYnNlcnZlcigpIHtcclxuICAgIGNvbnN0IHJvb3RFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2h0bWwnKVswXTtcclxuICAgIGNvbnN0IG11dGF0aW9uT2JzZXJ2ZXJDb25maWcgPSB7YXR0cmlidXRlczogZmFsc2UsIGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZX07XHJcbiAgICB0aGlzLm9ic2VydmVyLm9ic2VydmUocm9vdEVsZW1lbnQsIG11dGF0aW9uT2JzZXJ2ZXJDb25maWcpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQW5hbHl0aWNzQ29uZmlndXJhdGlvbih1cmw6IHN0cmluZykge1xyXG4gICAgdGhpcy5nZXRDb25maWd1cmF0aW9uJCh1cmwpLnN1YnNjcmliZShldmVudENvbmZpZ0RlZmluaXRpb24gPT4gdGhpcy5pbml0aWFsaXplRXZlbnRDb25maWdEZWZpbml0aW9uKGV2ZW50Q29uZmlnRGVmaW5pdGlvbikpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplRXZlbnRDb25maWdEZWZpbml0aW9uKGV2ZW50Q29uZmlnRGVmaW5pdGlvbjogSUV2ZW50Q29uZmlnRGVmaW5pdGlvbiB8IHVuZGVmaW5lZCkge1xyXG4gICAgaWYgKF8uaXNFbXB0eShldmVudENvbmZpZ0RlZmluaXRpb24/LmNvbmZpZ3MpKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignTm8gYW5hbHl0aWNzIGNvbmZpZ3VyYXRpb24gZm91bmQnKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudmFsaWRhdGVFdmVudENvbmZpZ0RlZmluaXRpb24oZXZlbnRDb25maWdEZWZpbml0aW9uISk7XHJcbiAgICBfLmVhY2goZXZlbnRDb25maWdEZWZpbml0aW9uIS5jb25maWdzLCBjb25maWcgPT4ge1xyXG4gICAgICBpZiAodGhpcy52ZXJzaW9uRmlsdGVyUHJlZGljYXRlKGNvbmZpZy5taW5WZXJzaW9uLCBjb25maWcubWF4VmVyc2lvbikpIHtcclxuICAgICAgICB0aGlzLmZpbHRlcmVkRXZlbnRzID0gdGhpcy5maWx0ZXJlZEV2ZW50cy5jb25jYXQoY29uZmlnLmV2ZW50cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChfLmlzRW1wdHkodGhpcy5maWx0ZXJlZEV2ZW50cykpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdObyBhbmFseXRpY3MgZXZlbnRzIGZvdW5kIGZvciB0aGlzIGFwcGxpY2F0aW9uIHZlcnNpb24nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZG9tQ2hhbmdlZCQuc3Vic2NyaWJlKCgpID0+IHRoaXMub25Eb21DaGFuZ2VkKCkpO1xyXG4gICAgdGhpcy5vbkRvbUNoYW5nZWQoKTtcclxuXHJcbiAgICBjb25zdCBkb2N1bWVudENvbmZpZ3MgPSBfLmZpbHRlcih0aGlzLmZpbHRlcmVkRXZlbnRzLFxyXG4gICAgICBkeW5hbWljRXZlbnQgPT4gdGhpcy5pc0R5bmFtaWNFdmVudFdpdGhTZWxlY3RvcihkeW5hbWljRXZlbnQpICYmIGR5bmFtaWNFdmVudC5zZWxlY3RvciA9PT0gJ2RvY3VtZW50JykgYXMgSUR5bmFtaWNFdmVudFdpdGhTZWxlY3RvcltdO1xyXG4gICAgdGhpcy5kb2N1bWVudENvbmZpZ0xpc3RlbmVycyA9IF8ubWFwKGRvY3VtZW50Q29uZmlncywgZHluYW1pY0V2ZW50ID0+IHRoaXMuZ2V0T25EeW5hbWljRXZlbnRIYW5kbGVyKGR5bmFtaWNFdmVudCkpO1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHRoaXMub25Eb2N1bWVudENsaWNrZWQoZXZlbnQpKTtcclxuXHJcbiAgICBjb25zdCBiZWZvcmVVbmxvYWRDb25maWdzID0gXy5maWx0ZXIodGhpcy5maWx0ZXJlZEV2ZW50cyxcclxuICAgICAgZHluYW1pY0V2ZW50ID0+IHRoaXMuaXNCZWZvcmVVbmxvYWRFdmVudFR5cGUoZHluYW1pY0V2ZW50KSkgYXMgSUR5bmFtaWNFdmVudFdpdGhFdmVudEFjdGlvbltdO1xyXG4gICAgdGhpcy5iZWZvcmVVbmxvYWRDb25maWdMaXN0ZW5lcnMgPSBfLm1hcChiZWZvcmVVbmxvYWRDb25maWdzLCBkeW5hbWljRXZlbnQgPT4gdGhpcy5nZXRPbkR5bmFtaWNFdmVudEhhbmRsZXIoZHluYW1pY0V2ZW50KSk7XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsICgpID0+IHRoaXMub25CZWZvcmVVbmxvYWQoKSk7XHJcbiAgfTtcclxuXHJcblxyXG4gIHByaXZhdGUgZ2V0Q29uZmlndXJhdGlvbiQodXJsOiBzdHJpbmcpIHtcclxuICAgIHJldHVybiB0aGlzLmh0dHBDbGllbnRcclxuICAgICAgLmdldCh1cmwpXHJcbiAgICAgIC5waXBlKFxyXG4gICAgICAgIGNhdGNoRXJyb3IoZXJyb3IgPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignVW5hYmxlIHRvIHJldHJpZXZlIGR5bmFtaWMgYW5hbHl0aWNzIGNvbmZpZ3VyYXRpb24nKTtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgcmV0dXJuIG9mKGVycm9yKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYXNFdmVudExpc3RlbmVyKGVsZW1lbnQ6IEVsZW1lbnQsIGR5bmFtaWNFdmVudDogSUR5bmFtaWNFdmVudFdpdGhTZWxlY3Rvcik6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgZXZlbnRSZWNvcmQgPSB0aGlzLmdldEV2ZW50UmVjb3JkKGVsZW1lbnQpO1xyXG4gICAgcmV0dXJuIGV2ZW50UmVjb3JkPy5ldmVudHNXaXRoSGFuZGxlcnMuc29tZShldmVudFdpdGhIYW5kbGUgPT4gZXZlbnRXaXRoSGFuZGxlLmR5bmFtaWNFdmVudCA9PT0gZHluYW1pY0V2ZW50KSA/PyBmYWxzZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0RXZlbnRSZWNvcmQoZWxlbWVudDogRWxlbWVudCk6IElFdmVudFJlY29yZCB8IHVuZGVmaW5lZCB7XHJcbiAgICByZXR1cm4gdGhpcy5ldmVudFJlY29yZHMuZmluZChlbnRyeSA9PiBlbnRyeS5lbGVtZW50ID09PSBlbGVtZW50KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2xlYW51cEV2ZW50UmVjb3JkcygpIHtcclxuICAgIGNvbnN0IGxpc3RlbmVyUmVjb3Jkc1RvQ2xlYW5VcCA9IHRoaXMuZXZlbnRSZWNvcmRzLmZpbHRlcihyZWNvcmQgPT4gIWRvY3VtZW50LmJvZHkuY29udGFpbnMocmVjb3JkLmVsZW1lbnQpKTtcclxuICAgIGxpc3RlbmVyUmVjb3Jkc1RvQ2xlYW5VcC5mb3JFYWNoKGV2ZW50UmVjb3JkID0+IHtcclxuICAgICAgZXZlbnRSZWNvcmQuZXZlbnRzV2l0aEhhbmRsZXJzLmZvckVhY2goKHtkeW5hbWljRXZlbnQsIGV2ZW50SGFuZGxlcn0pID0+IHtcclxuICAgICAgICBldmVudFJlY29yZC5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZHluYW1pY0V2ZW50LnNlbGVjdG9yLCBldmVudEhhbmRsZXIpO1xyXG4gICAgICB9KVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLmV2ZW50UmVjb3JkcyA9IF8uZGlmZmVyZW5jZSh0aGlzLmV2ZW50UmVjb3JkcywgbGlzdGVuZXJSZWNvcmRzVG9DbGVhblVwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcihlbGVtZW50OiBFbGVtZW50LCBkeW5hbWljRXZlbnQ6IElEeW5hbWljRXZlbnRXaXRoU2VsZWN0b3IpIHtcclxuICAgIGxldCBldmVudEhhbmRsZXIgPSB0aGlzLmdldE9uRHluYW1pY0V2ZW50SGFuZGxlcihkeW5hbWljRXZlbnQsIGVsZW1lbnQpO1xyXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGR5bmFtaWNFdmVudC5ldmVudEFjdGlvbiwgZXZlbnRIYW5kbGVyKTtcclxuXHJcbiAgICBsZXQgZXZlbnRSZWNvcmQgPSB0aGlzLmdldEV2ZW50UmVjb3JkKGVsZW1lbnQpO1xyXG4gICAgaWYgKF8uaXNOaWwoZXZlbnRSZWNvcmQpKSB7XHJcbiAgICAgIGV2ZW50UmVjb3JkID0ge1xyXG4gICAgICAgIGVsZW1lbnQsXHJcbiAgICAgICAgZXZlbnRzV2l0aEhhbmRsZXJzOiBbXVxyXG4gICAgICB9O1xyXG4gICAgICB0aGlzLmV2ZW50UmVjb3Jkcy5wdXNoKGV2ZW50UmVjb3JkKTtcclxuICAgIH1cclxuICAgIGV2ZW50UmVjb3JkLmV2ZW50c1dpdGhIYW5kbGVycy5wdXNoKHtcclxuICAgICAgZHluYW1pY0V2ZW50LFxyXG4gICAgICBldmVudEhhbmRsZXJcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRPbkR5bmFtaWNFdmVudEhhbmRsZXIoZHluYW1pY0V2ZW50OiBJRHluYW1pY0V2ZW50V2l0aEV2ZW50QWN0aW9uLCBlbGVtZW50PzogRWxlbWVudCk6IChldmVudD86IEV2ZW50KSA9PiB2b2lkIHtcclxuICAgIHJldHVybiAoZXZlbnQ/OiBFdmVudCkgPT4ge1xyXG4gICAgICBpZiAoIV8uaXNOaWwoZWxlbWVudCkgJiYgdGhpcy5pc0R5bmFtaWNFdmVudFdpdGhTZWxlY3RvcihkeW5hbWljRXZlbnQpKSB7XHJcbiAgICAgICAgY29uc3QgZWxlbWVudHNNYXRjaGluZ1NlbGVjdG9yID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChkeW5hbWljRXZlbnQuc3RhdHVzU2VsZWN0b3IgPz8gZHluYW1pY0V2ZW50LnNlbGVjdG9yKTtcclxuICAgICAgICBjb25zdCBkb2VzRWxlbWVudE1hdGNoQ29uZmlnID0gXy5pc05pbChkeW5hbWljRXZlbnQuc3RhdHVzU2VsZWN0b3IpID8gXy5maW5kKGVsZW1lbnRzTWF0Y2hpbmdTZWxlY3RvciwgZXhpc3RpbmdFbGVtZW50ID0+IGV4aXN0aW5nRWxlbWVudCA9PT0gZWxlbWVudCkgOiBlbGVtZW50c01hdGNoaW5nU2VsZWN0b3IubGVuZ3RoID4gMDtcclxuICAgICAgICBpZiAoIWRvZXNFbGVtZW50TWF0Y2hDb25maWcpIHtcclxuICAgICAgICAgIHRoaXMubG9nKGBFbGVtZW50IG5vIGxvbmdlciBtYXRjaGVzIHNlbGVjdG9yLiBDYW5jZWxsaW5nIGV2ZW50ICR7ZHluYW1pY0V2ZW50LmlkfWApO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICB0aGlzLm9uU2ltcGxlT3JTZXF1ZW5jZUV2ZW50KGR5bmFtaWNFdmVudCwgZXZlbnQpO1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbG9nKHRleHQ6IHN0cmluZykge1xyXG4gICAgaWYgKHRoaXMubG9nZ2luZ0VuYWJsZWQpIHtcclxuICAgICAgY29uc29sZS5sb2codGV4dCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG9uU2ltcGxlT3JTZXF1ZW5jZUV2ZW50KGR5bmFtaWNFdmVudDogSUR5bmFtaWNFdmVudFdpdGhFdmVudEFjdGlvbiB8IElTaW1wbGVFdmVudCB8IElTZXF1ZW5jZUV2ZW50LCBldmVudD86IEV2ZW50KSB7XHJcbiAgICBjb25zdCBpc1NpbXBsZUV2ZW50ID0gdGhpcy5pc1NpbXBsZUV2ZW50KGR5bmFtaWNFdmVudCk7XHJcbiAgICBpZiAoaXNTaW1wbGVFdmVudCkge1xyXG4gICAgICBpZiAoXy5pc05pbChldmVudCkgfHwgIXRoaXMuaXNLZXlib2FyZEV2ZW50VHlwZShkeW5hbWljRXZlbnQpIHx8ICFkeW5hbWljRXZlbnQuaXNBbHBoYU51bWVyaWMgfHwgdGhpcy5pc0FscGhhTnVtZXJpY0tleWJvYXJkRXZlbnQoZXZlbnQpKSB7XHJcbiAgICAgICAgY29uc3QgYWRkaXRpb25hbERhdGEgPSB0aGlzLmdldEFkZGl0aW9uYWxFdmVudERhdGEoZHluYW1pY0V2ZW50KTtcclxuICAgICAgICB0aGlzLnRyYWNrRXZlbnQoZHluYW1pY0V2ZW50LCBhZGRpdGlvbmFsRGF0YSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNTaW1wbGVFdmVudCB8fCB0aGlzLmlzU2VxdWVuY2VFdmVudChkeW5hbWljRXZlbnQpKSB7XHJcbiAgICAgIHRoaXMub25TZXF1ZW5jZUV2ZW50KGR5bmFtaWNFdmVudCwgZXZlbnQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBZGRpdGlvbmFsRXZlbnREYXRhKGR5bmFtaWNFdmVudDogSUR5bmFtaWNFdmVudEJhc2UpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgbGV0IGFkZGl0aW9uYWxEYXRhOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgICBpZiAoIV8uaXNOaWwoZHluYW1pY0V2ZW50LmFkZGl0aW9uYWxEYXRhU2VsZWN0b3IpKSB7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnRXaXRoRGF0YSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZHluYW1pY0V2ZW50LmFkZGl0aW9uYWxEYXRhU2VsZWN0b3IpO1xyXG4gICAgICBpZiAoIV8uaXNOaWwoZWxlbWVudFdpdGhEYXRhKSkge1xyXG4gICAgICAgIGlmIChlbGVtZW50V2l0aERhdGEgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50KSB7XHJcbiAgICAgICAgICBhZGRpdGlvbmFsRGF0YSA9IGVsZW1lbnRXaXRoRGF0YS52YWx1ZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYWRkaXRpb25hbERhdGEgPSBlbGVtZW50V2l0aERhdGEuaW5uZXJIVE1MXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYWRkaXRpb25hbERhdGE7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzQWxwaGFOdW1lcmljS2V5Ym9hcmRFdmVudChldmVudDogRXZlbnQpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAoZXZlbnQhIGFzIHVua25vd24gYXMgS2V5Ym9hcmRFdmVudCk/LmtleS5sZW5ndGggPT09IDE7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG9uRG9jdW1lbnRDbGlja2VkKGV2ZW50OiBFdmVudCkge1xyXG4gICAgXy5lYWNoKHRoaXMuZG9jdW1lbnRDb25maWdMaXN0ZW5lcnMsIGxpc3RlbmVyID0+IGxpc3RlbmVyKGV2ZW50KSk7XHJcbiAgICB0aGlzLmRvbUNoYW5nZWQkLm5leHQoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb25CZWZvcmVVbmxvYWQoKSB7XHJcbiAgICBfLmVhY2godGhpcy5iZWZvcmVVbmxvYWRDb25maWdMaXN0ZW5lcnMsIGxpc3RlbmVyID0+IGxpc3RlbmVyKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmb3JtYXREeW5hbWljRXZlbnRTdHJpbmcoZXZlbnQ6IER5bmFtaWNFdmVudCk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBpc1NpbXBsZUV2ZW50ID0gdGhpcy5pc1NpbXBsZUV2ZW50KGV2ZW50KTtcclxuICAgIGlmIChpc1NpbXBsZUV2ZW50IHx8IHRoaXMuaXNTZXF1ZW5jZUV2ZW50KGV2ZW50KSkge1xyXG4gICAgICBsZXQgbG9nRGV0YWlscyA9IGAke2V2ZW50LmlkfS4gJHtldmVudC5tZXNzYWdlfWA7XHJcbiAgICAgIGlmICghXy5pc05pbChldmVudC5zZWxlY3RvcikpIHtcclxuICAgICAgICBsb2dEZXRhaWxzICs9IGAuICR7ZXZlbnQuc2VsZWN0b3J9YDtcclxuICAgICAgfVxyXG4gICAgICBpZiAoaXNTaW1wbGVFdmVudCkge1xyXG4gICAgICAgIHJldHVybiBgKiogVHJhY2tpbmcgc2ltcGxlIGV2ZW50OiAke2xvZ0RldGFpbHN9YDtcclxuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzU2VxdWVuY2VFdmVudChldmVudCkpIHtcclxuICAgICAgICByZXR1cm4gYFNlcXVlbmNlIGV2ZW50OiAke2xvZ0RldGFpbHN9ICR7dGhpcy5nZXRTZXF1ZW5jZVByb2dyZXNzKGV2ZW50KX1gO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYCoqIFRyYWNraW5nIHNlcXVlbmNlOiAke2V2ZW50LmlkfS4gJHtldmVudC5tZXNzYWdlfWA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFNlcXVlbmNlUHJvZ3Jlc3MoZHluYW1pY0V2ZW50OiBJU2VxdWVuY2VFdmVudCB8IElTZXF1ZW5jZSk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBzZXF1ZW5jZXNDb250YWluaW5nVGhpc0V2ZW50ID1cclxuICAgICAgXy5maWx0ZXIodGhpcy5maWx0ZXJlZEV2ZW50cywgZmlsdGVyZWREeW5hbWljRXZlbnQgPT4gdGhpcy5pc1NlcXVlbmNlKGZpbHRlcmVkRHluYW1pY0V2ZW50KSAmJlxyXG4gICAgICAgIF8uaW5jbHVkZXMoZmlsdGVyZWREeW5hbWljRXZlbnQuc2VxdWVuY2VFdmVudHMsIGR5bmFtaWNFdmVudC5pZClcclxuICAgICAgKSBhcyBJU2VxdWVuY2VbXTtcclxuICAgIGNvbnN0IHByb2dyZXNzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgXy5lYWNoKHNlcXVlbmNlc0NvbnRhaW5pbmdUaGlzRXZlbnQsIHNlcXVlbmNlID0+IHtcclxuICAgICAgaWYgKF8uaW5jbHVkZXModGhpcy5zZXF1ZW5jZVRyYWNrZXJbc2VxdWVuY2UuaWRdLCBkeW5hbWljRXZlbnQuaWQpKSB7XHJcbiAgICAgICAgcHJvZ3Jlc3MucHVzaChgU2VxdWVuY2UgJHtzZXF1ZW5jZS5pZH0gPSAke3RoaXMuc2VxdWVuY2VUcmFja2VyW3NlcXVlbmNlLmlkXS5sZW5ndGh9LyR7c2VxdWVuY2Uuc2VxdWVuY2VFdmVudHMubGVuZ3RofWApO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBwcm9ncmVzcy5qb2luKCcsICcpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvblNlcXVlbmNlRXZlbnQoZHluYW1pY0V2ZW50OiBJU2ltcGxlRXZlbnQgfCBJU2VxdWVuY2VFdmVudCB8IElTZXF1ZW5jZSwgZXZlbnQ/OiBFdmVudCkge1xyXG4gICAgY29uc3Qgc2VxdWVuY2VzQ2FuY2VsbGVkQnlUaGlzRXZlbnQgPVxyXG4gICAgICBfLmZpbHRlcih0aGlzLmZpbHRlcmVkRXZlbnRzLCBmaWx0ZXJlZER5bmFtaWNFdmVudCA9PiB0aGlzLmlzU2VxdWVuY2UoZmlsdGVyZWREeW5hbWljRXZlbnQpICYmXHJcbiAgICAgICAgXy5pbmNsdWRlcyhmaWx0ZXJlZER5bmFtaWNFdmVudC5jYW5jZWxFdmVudHMsIGR5bmFtaWNFdmVudC5pZClcclxuICAgICAgKSBhcyBJU2VxdWVuY2VbXTtcclxuICAgIGlmICghXy5pc0VtcHR5KHNlcXVlbmNlc0NhbmNlbGxlZEJ5VGhpc0V2ZW50KSkge1xyXG4gICAgICBjb25zdCByZXNldFNlcXVlbmNlczogSVNlcXVlbmNlW10gPSBbXTtcclxuICAgICAgXy5lYWNoKHNlcXVlbmNlc0NhbmNlbGxlZEJ5VGhpc0V2ZW50LCBzZXF1ZW5jZSA9PiB7XHJcbiAgICAgICAgY29uc3QgdHJhY2tlciA9IHRoaXMuc2VxdWVuY2VUcmFja2VyW3NlcXVlbmNlLmlkXSA9IHRoaXMuc2VxdWVuY2VUcmFja2VyW3NlcXVlbmNlLmlkXSA/PyBbXTtcclxuICAgICAgICBpZiAoIV8uaXNFbXB0eSh0cmFja2VyKSAmJiBfLmluY2x1ZGVzKHNlcXVlbmNlLmNhbmNlbEV2ZW50cywgZHluYW1pY0V2ZW50LmlkKSAmJiAhdGhpcy5kb2VzRXZlbnRUYXJnZXRUcmlnZ2VyU2VxdWVuY2VFdmVudChzZXF1ZW5jZSwgZXZlbnQpKSB7XHJcbiAgICAgICAgICByZXNldFNlcXVlbmNlcy5wdXNoKHNlcXVlbmNlKTtcclxuICAgICAgICAgIHRoaXMucmVzZXRTZXF1ZW5jZShzZXF1ZW5jZSk7XHJcbiAgICAgICAgICB0aGlzLmJsb2NrZWRTZXF1ZW5jZUlkcy5wdXNoKHNlcXVlbmNlLmlkKTtcclxuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICBfLnB1bGwodGhpcy5ibG9ja2VkU2VxdWVuY2VJZHMsIHNlcXVlbmNlLmlkKTtcclxuICAgICAgICAgIH0sIDEwKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAoIV8uaXNFbXB0eShyZXNldFNlcXVlbmNlcykpIHtcclxuICAgICAgICB0aGlzLmxvZyhgU2VxdWVuY2UgcmVzZXQgYnkgZXZlbnQgJHtkeW5hbWljRXZlbnQuaWR9OiAke3Jlc2V0U2VxdWVuY2VzLm1hcChzZXF1ZW5jZSA9PiBzZXF1ZW5jZS5pZCkuam9pbignLCcpfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2VxdWVuY2VzQ29udGFpbmluZ1RoaXNFdmVudCA9XHJcbiAgICAgIF8uZmlsdGVyKHRoaXMuZmlsdGVyZWRFdmVudHMsIGZpbHRlcmVkRHluYW1pY0V2ZW50ID0+IHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLmlzU2VxdWVuY2UoZmlsdGVyZWREeW5hbWljRXZlbnQpICYmXHJcbiAgICAgICAgICAgIF8uaW5jbHVkZXMoZmlsdGVyZWREeW5hbWljRXZlbnQuc2VxdWVuY2VFdmVudHMsIGR5bmFtaWNFdmVudC5pZCkgJiZcclxuICAgICAgICAgICAgIV8uaW5jbHVkZXModGhpcy5ibG9ja2VkU2VxdWVuY2VJZHMsIGZpbHRlcmVkRHluYW1pY0V2ZW50LmlkKTtcclxuICAgICAgICB9XHJcbiAgICAgICkgYXMgSVNlcXVlbmNlW107XHJcbiAgICBjb25zb2xlLmxvZyhgc2VxdWVuY2VzQ29udGFpbmluZ1RoaXNFdmVudDogJHtzZXF1ZW5jZXNDb250YWluaW5nVGhpc0V2ZW50Lm1hcChzID0+IHMuaWQpLmpvaW4oJywgJyl9YCk7XHJcbiAgICBfLmVhY2goc2VxdWVuY2VzQ29udGFpbmluZ1RoaXNFdmVudCwgc2VxdWVuY2UgPT4ge1xyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICBfLnB1bGwodGhpcy5ibG9ja2VkU2VxdWVuY2VJZHMsIHNlcXVlbmNlLmlkKTtcclxuICAgICAgfSwgMTApO1xyXG4gICAgICBjb25zdCB0cmFja2VyID0gdGhpcy5zZXF1ZW5jZVRyYWNrZXJbc2VxdWVuY2UuaWRdID0gdGhpcy5zZXF1ZW5jZVRyYWNrZXJbc2VxdWVuY2UuaWRdID8/IFtdO1xyXG5cclxuICAgICAgaWYgKHNlcXVlbmNlLnNlcXVlbmNlRXZlbnRzW3RyYWNrZXIubGVuZ3RoXSA9PT0gZHluYW1pY0V2ZW50LmlkKSB7XHJcbiAgICAgICAgdGhpcy5sb2coYEFkZGluZyBldmVudCAke2R5bmFtaWNFdmVudC5pZH0gdG8gU2VxdWVuY2UgJHtzZXF1ZW5jZS5pZH0gdHJhY2tlcmApO1xyXG4gICAgICAgIHRyYWNrZXIucHVzaChkeW5hbWljRXZlbnQuaWQpO1xyXG4gICAgICAgIHRoaXMuYmxvY2tlZFNlcXVlbmNlSWRzLnB1c2goc2VxdWVuY2UuaWQpO1xyXG4gICAgICAgIC8vIHRoaXMubG9nRXZlbnQoZHluYW1pY0V2ZW50KTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodHJhY2tlci5sZW5ndGggPT09IHNlcXVlbmNlLnNlcXVlbmNlRXZlbnRzLmxlbmd0aCkge1xyXG4gICAgICAgIHRoaXMubG9nKGBTZXF1ZW5jZSAke3NlcXVlbmNlLmlkfSBjb21wbGV0ZWApO1xyXG4gICAgICAgIHRoaXMudHJhY2tBbmRSZXNldFNlcXVlbmNlKHNlcXVlbmNlKTtcclxuICAgICAgICB0aGlzLm9uU2VxdWVuY2VFdmVudChzZXF1ZW5jZSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3QgbmV4dEV2ZW50SWRJblNlcXVlbmNlID0gc2VxdWVuY2Uuc2VxdWVuY2VFdmVudHNbdHJhY2tlci5sZW5ndGhdO1xyXG4gICAgICAgIGNvbnN0IG5leHRFdmVudEluU2VxdWVuY2UgPSBfLmZpbmQodGhpcy5maWx0ZXJlZEV2ZW50cywge2lkOiBuZXh0RXZlbnRJZEluU2VxdWVuY2V9KTtcclxuICAgICAgICBpZiAoXy5pc05pbChuZXh0RXZlbnRJblNlcXVlbmNlKSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvcjogTmV4dCBldmVudCBpbiBzZXF1ZW5jZSBub3QgZm91bmQuIEluY29ycmVjdCBJZCBzcGVjaWZpZWQ/IE5leHQgZXZlbnQgaWQgJHtuZXh0RXZlbnRJZEluU2VxdWVuY2V9LiBTZXF1ZW5jZSAke3NlcXVlbmNlLmlkfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc1RpbWVkRXZlbnQobmV4dEV2ZW50SW5TZXF1ZW5jZSkpIHtcclxuICAgICAgICAgIHRoaXMuc3RhcnRUaW1lZEV2ZW50VGltZXJGb3JTZXF1ZW5jZShuZXh0RXZlbnRJblNlcXVlbmNlLCBzZXF1ZW5jZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhcnRUaW1lZEV2ZW50VGltZXJGb3JTZXF1ZW5jZShkeW5hbWljRXZlbnQ6IElUaW1lZEV2ZW50LCBzZXF1ZW5jZTogSVNlcXVlbmNlKSB7XHJcbiAgICBjb25zdCB0aW1lciA9IGR5bmFtaWNFdmVudC50aW1lb3V0O1xyXG4gICAgaWYgKHRpbWVyID4gMCkge1xyXG4gICAgICBjb25zdCB0cmFja2VyID0gdGhpcy50aW1lZEV2ZW50Rm9yU2VxdWVuY2VUcmFja2VyW3NlcXVlbmNlLmlkXSA9IHRoaXMudGltZWRFdmVudEZvclNlcXVlbmNlVHJhY2tlcltzZXF1ZW5jZS5pZF0gPz8ge307XHJcbiAgICAgIGlmICghXy5pc05pbCh0cmFja2VyW2R5bmFtaWNFdmVudC5pZF0pKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaW1lciBldmVudCBhbHJlYWR5IGV4aXN0cyBmb3IgZXZlbnQgJHtkeW5hbWljRXZlbnQuaWR9IGluIHNlcXVlbmNlICR7c2VxdWVuY2UuaWR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5sb2coYFRpbWVyIHN0YXJ0aW5nIGZvciBldmVudCAke2R5bmFtaWNFdmVudC5pZH0gaW4gc2VxdWVuY2UgJHtzZXF1ZW5jZS5pZH1gKTtcclxuICAgICAgdHJhY2tlcltkeW5hbWljRXZlbnQuaWRdID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgZGVsZXRlIHRyYWNrZXJbZHluYW1pY0V2ZW50LmlkXTtcclxuICAgICAgICB0aGlzLmxvZyhgVGltZXIgY29tcGxldGUgZm9yIGV2ZW50ICR7ZHluYW1pY0V2ZW50LmlkfSBpbiBzZXF1ZW5jZSAke3NlcXVlbmNlLmlkfWApO1xyXG4gICAgICAgIHRoaXMub25TaW1wbGVPclNlcXVlbmNlRXZlbnQoZHluYW1pY0V2ZW50KTtcclxuICAgICAgfSwgdGltZXIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaW1lb3V0IHZhbHVlIG11c3QgYmUgZ3JlYXRlciB0aGFuIDAgZm9yIGV2ZW50ICR7ZHluYW1pY0V2ZW50LmlkfWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNldFRpbWVyc0ZvclNlcXVlbmNlKHNlcXVlbmNlOiBJU2VxdWVuY2UpIHtcclxuICAgIGNvbnN0IHRyYWNrZXIgPSB0aGlzLnRpbWVkRXZlbnRGb3JTZXF1ZW5jZVRyYWNrZXJbc2VxdWVuY2UuaWRdO1xyXG4gICAgaWYgKCFfLmlzTmlsKHRyYWNrZXIpKSB7XHJcbiAgICAgIF8uZWFjaCh0cmFja2VyLCB0aW1lb3V0SWQgPT4gY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCkpO1xyXG4gICAgfVxyXG4gICAgZGVsZXRlIHRoaXMudGltZWRFdmVudEZvclNlcXVlbmNlVHJhY2tlcltzZXF1ZW5jZS5pZF07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0U2VxdWVuY2Uoc2VxdWVuY2U6IElTZXF1ZW5jZSkge1xyXG4gICAgdGhpcy5zZXF1ZW5jZVRyYWNrZXJbc2VxdWVuY2UuaWRdID0gW107XHJcbiAgICB0aGlzLnJlc2V0VGltZXJzRm9yU2VxdWVuY2Uoc2VxdWVuY2UpO1xyXG4gICAgdGhpcy5sb2coYENhbmNlbGxpbmcgc2VxdWVuY2U6ICR7c2VxdWVuY2UuaWR9LiBNZXNzYWdlOiAke3NlcXVlbmNlLm1lc3NhZ2V9YCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRyYWNrQW5kUmVzZXRTZXF1ZW5jZShzZXF1ZW5jZTogSVNlcXVlbmNlKSB7XHJcbiAgICB0aGlzLnJlc2V0U2VxdWVuY2Uoc2VxdWVuY2UpO1xyXG4gICAgaWYgKHNlcXVlbmNlLmlzVHJhY2thYmxlKSB7XHJcbiAgICAgIGNvbnN0IGFkZGl0aW9uYWxEYXRhID0gdGhpcy5nZXRBZGRpdGlvbmFsRXZlbnREYXRhKHNlcXVlbmNlKTtcclxuICAgICAgdGhpcy50cmFja0V2ZW50KHNlcXVlbmNlLCBhZGRpdGlvbmFsRGF0YSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHRyYWNrRXZlbnQoZXZlbnQ6IER5bmFtaWNFdmVudCwgYWRkaXRpb25hbERhdGE6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xyXG4gICAgdGhpcy5sb2dFdmVudChldmVudCk7XHJcbiAgICB0aGlzLm9uRXZlbnQubmV4dCh7XHJcbiAgICAgIC4uLmV2ZW50LFxyXG4gICAgICBhZGRpdGlvbmFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvZ0V2ZW50KGV2ZW50OiBEeW5hbWljRXZlbnQpIHtcclxuICAgIGlmICh0aGlzLmlzU2VxdWVuY2UoZXZlbnQpICYmICFldmVudC5pc1RyYWNrYWJsZSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmxvZyh0aGlzLmZvcm1hdER5bmFtaWNFdmVudFN0cmluZyhldmVudCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc1NlcXVlbmNlRXZlbnQoZXZlbnQ6IER5bmFtaWNFdmVudCk6IGV2ZW50IGlzIElTZXF1ZW5jZUV2ZW50IHtcclxuICAgIHJldHVybiBldmVudC5keW5hbWljVHlwZSA9PT0gRHluYW1pY1R5cGUuU2VxdWVuY2VFdmVudDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaXNTaW1wbGVFdmVudChldmVudDogRHluYW1pY0V2ZW50KTogZXZlbnQgaXMgSVNpbXBsZUV2ZW50IHtcclxuICAgIHJldHVybiBldmVudC5keW5hbWljVHlwZSA9PT0gRHluYW1pY1R5cGUuU2ltcGxlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc0R5bmFtaWNFdmVudFdpdGhFdmVudFR5cGUoZXZlbnQ6IER5bmFtaWNFdmVudCk6IGV2ZW50IGlzIElEeW5hbWljRXZlbnRXaXRoRXZlbnRBY3Rpb24ge1xyXG4gICAgcmV0dXJuICh0aGlzLmlzU2ltcGxlRXZlbnQoZXZlbnQpIHx8IHRoaXMuaXNTZXF1ZW5jZUV2ZW50KGV2ZW50KSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzQmVmb3JlVW5sb2FkRXZlbnRUeXBlKGV2ZW50OiBEeW5hbWljRXZlbnQpOiBldmVudCBpcyBJQmVmb3JlVW5sb2FkRXZlbnQge1xyXG4gICAgcmV0dXJuICh0aGlzLmlzU2ltcGxlRXZlbnQoZXZlbnQpIHx8IHRoaXMuaXNTZXF1ZW5jZUV2ZW50KGV2ZW50KSkgJiYgZXZlbnQuZXZlbnRBY3Rpb24gPT09IE1pc2NlbGxhbmVvdXNFdmVudEFjdGlvbi5CZWZvcmV1bmxvYWQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzS2V5Ym9hcmRFdmVudFR5cGUoZXZlbnQ6IER5bmFtaWNFdmVudCk6IGV2ZW50IGlzIElLZXlib2FyZEV2ZW50IHtcclxuICAgIHJldHVybiAodGhpcy5pc1NpbXBsZUV2ZW50KGV2ZW50KSB8fCB0aGlzLmlzU2VxdWVuY2VFdmVudChldmVudCkpICYmIGV2ZW50LmV2ZW50QWN0aW9uIGluIEtleWJvYXJkRXZlbnRBY3Rpb247XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzRHluYW1pY0V2ZW50V2l0aFNlbGVjdG9yKGV2ZW50OiBEeW5hbWljRXZlbnQpOiBldmVudCBpcyBJRHluYW1pY0V2ZW50V2l0aFNlbGVjdG9yIHtcclxuICAgIHJldHVybiAodGhpcy5pc1NpbXBsZUV2ZW50KGV2ZW50KSB8fCB0aGlzLmlzU2VxdWVuY2VFdmVudChldmVudCkpICYmIGV2ZW50LnNlbGVjdG9yICE9PSB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzU2VxdWVuY2UoZXZlbnQ6IER5bmFtaWNFdmVudCk6IGV2ZW50IGlzIElTZXF1ZW5jZSB7XHJcbiAgICByZXR1cm4gZXZlbnQuZHluYW1pY1R5cGUgPT09IER5bmFtaWNUeXBlLlNlcXVlbmNlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc1RpbWVkRXZlbnQoZXZlbnQ6IER5bmFtaWNFdmVudCk6IGV2ZW50IGlzIElUaW1lZEV2ZW50IHtcclxuICAgIHJldHVybiB0aGlzLmlzRHluYW1pY0V2ZW50V2l0aEV2ZW50VHlwZShldmVudCkgJiYgZXZlbnQuZXZlbnRBY3Rpb24gPT09IE1pc2NlbGxhbmVvdXNFdmVudEFjdGlvbi5UaW1lZDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZG9lc0V2ZW50VGFyZ2V0VHJpZ2dlclNlcXVlbmNlRXZlbnQoc2VxdWVuY2U6IElTZXF1ZW5jZSwgZXZlbnQ/OiBFdmVudCkge1xyXG4gICAgaWYgKF8uaXNOaWwoZXZlbnQpKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIGNvbnN0IHRyYWNrZXIgPSB0aGlzLnNlcXVlbmNlVHJhY2tlcltzZXF1ZW5jZS5pZF07XHJcbiAgICBpZiAoXy5pc0VtcHR5KHRyYWNrZXIpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBvdGhlclNlcXVlbmNlRXZlbnRJZCA9IHNlcXVlbmNlLnNlcXVlbmNlRXZlbnRzW3RyYWNrZXIubGVuZ3RoIC0gMV07XHJcbiAgICBjb25zdCBzZXF1ZW5jZUV2ZW50ID0gXy5maW5kKHRoaXMuZmlsdGVyZWRFdmVudHMsIGR5bmFtaWNFdmVudCA9PiBkeW5hbWljRXZlbnQuaWQgPT09IG90aGVyU2VxdWVuY2VFdmVudElkKSE7XHJcbiAgICBpZiAoIXRoaXMuaXNEeW5hbWljRXZlbnRXaXRoU2VsZWN0b3Ioc2VxdWVuY2VFdmVudCkpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgZWxlbWVudHNNYXRjaGluZ1NlbGVjdG9yID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZXF1ZW5jZUV2ZW50LnN0YXR1c1NlbGVjdG9yID8/IHNlcXVlbmNlRXZlbnQuc2VsZWN0b3IpO1xyXG4gICAgY29uc3QgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0IGFzIE5vZGU7XHJcbiAgICBjb25zdCBpc0V2ZW50VGFyZ2V0V2l0aGluQW55TWF0Y2hlZEVsZW1lbnRzID0gXy5zb21lKGVsZW1lbnRzTWF0Y2hpbmdTZWxlY3RvciwgZWxlbWVudCA9PiBlbGVtZW50ID09PSB0YXJnZXQgfHwgZWxlbWVudC5jb250YWlucyh0YXJnZXQpKTtcclxuXHJcbiAgICByZXR1cm4gaXNFdmVudFRhcmdldFdpdGhpbkFueU1hdGNoZWRFbGVtZW50cztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdmFsaWRhdGVFdmVudENvbmZpZ0RlZmluaXRpb24oZXZlbnRDb25maWdEZWZpbml0aW9uOiBJRXZlbnRDb25maWdEZWZpbml0aW9uKSB7XHJcbiAgICBjb25zdCB1bmlxdWVFdmVudElkcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xyXG4gICAgY29uc3QgdW5pcXVlU2VxdWVuY2VFdmVudElkcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xyXG4gICAgY29uc3QgdW5pcXVlQ2FuY2VsRXZlbnRJZHMgPSBuZXcgU2V0PG51bWJlcj4oKTtcclxuICAgIF8uZWFjaChldmVudENvbmZpZ0RlZmluaXRpb24uY29uZmlncywgY29uZmlnID0+IHtcclxuICAgICAgaWYgKCF0aGlzLnZlcnNpb25GaWx0ZXJQcmVkaWNhdGUoY29uZmlnLm1pblZlcnNpb24sIGNvbmZpZy5tYXhWZXJzaW9uKSkge1xyXG4gICAgICAgIHJldHVybjsgLy8gU2tpcHBpbmcuIENvbmZpZyBkb2Vzbid0IGFwcGx5IHRvIHRoaXMgdmVyc2lvbi4gRHVwbGljYXRlIGV2ZW50cyBldGMuIGRvbid0IG1hdHRlciBpZiBhIGNvbmZpZyBpcyB1bnVzZWQuXHJcbiAgICAgIH1cclxuICAgICAgXy5lYWNoKGNvbmZpZy5ldmVudHMsIGV2ZW50ID0+IHtcclxuICAgICAgICBpZiAodW5pcXVlRXZlbnRJZHMuaGFzKGV2ZW50LmlkKSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFdmVudCBpZHMgbXVzdCBiZSB1bmlxdWUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdW5pcXVlRXZlbnRJZHMuYWRkKGV2ZW50LmlkKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuaXNTZXF1ZW5jZShldmVudCkpIHtcclxuICAgICAgICAgIGlmIChldmVudC5zZXF1ZW5jZUV2ZW50cy5sZW5ndGggPCAyKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignU2VxdWVuY2VzIG11c3QgaGF2ZSBhdCBsZWFzdCAyIGV2ZW50IGlkcycpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZXZlbnQuc2VxdWVuY2VFdmVudHMuZm9yRWFjaChpZCA9PiB7XHJcbiAgICAgICAgICAgIGlmIChpZCA9PT0gZXZlbnQuaWQpIHtcclxuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcXVlbmNlcyBjYW5ub3QgcmVmZXJlbmNlIHRoZWlyIG93biBpZCBhcyBhIHNlcXVlbmNlIGV2ZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdW5pcXVlU2VxdWVuY2VFdmVudElkcy5hZGQoaWQpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBldmVudC5jYW5jZWxFdmVudHMuZm9yRWFjaChpZCA9PiB7XHJcbiAgICAgICAgICAgIGlmIChpZCA9PT0gZXZlbnQuaWQpIHtcclxuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcXVlbmNlcyBjYW5ub3QgcmVmZXJlbmNlIHRoZWlyIG93biBpZCBhcyBhIGNhbmNlbCBldmVudCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHVuaXF1ZUNhbmNlbEV2ZW50SWRzLmFkZChpZCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmlzVGltZWRFdmVudChldmVudCkgJiYgKGV2ZW50LnRpbWVvdXQgPD0gMCB8fCBfLmlzTmFOKGV2ZW50LnRpbWVvdXQpKSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaW1lb3V0IGV2ZW50IG11c3QgYmUgYSBudW1iZXIgZ3JlYXRlciB0aGFuIHplcm8nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghXy5pc05pbChldmVudC5hZGRpdGlvbmFsRGF0YSkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQWRkaXRpb25hbCBkYXRhIG11c3Qgbm90IGJlIHByb3ZpZGVkIGluIHRoZSBjb25maWd1cmF0aW9uLiBVc2UgdGhlIGBhZGRpdGlvbmFsRGF0YVNlbGVjdG9yYCB0byBhbGxvdyB0aGUgc2VydmljZSB0byBmaW5kIGFkZGl0aW9uYWwgZGF0YSBpbiB0aGUgRE9NIGF0IGV2ZW50LXRpbWUnKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdW5pcXVlU2VxdWVuY2VFdmVudElkcy5mb3JFYWNoKGlkID0+IHtcclxuICAgICAgaWYgKCF1bmlxdWVFdmVudElkcy5oYXMoaWQpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXF1ZW5jZSBldmVudHMgbXVzdCBleGlzdCcpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHVuaXF1ZUNhbmNlbEV2ZW50SWRzLmZvckVhY2goaWQgPT4ge1xyXG4gICAgICBpZiAoIXVuaXF1ZUV2ZW50SWRzLmhhcyhpZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbmNlbCBldmVudHMgbXVzdCBleGlzdCcpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19