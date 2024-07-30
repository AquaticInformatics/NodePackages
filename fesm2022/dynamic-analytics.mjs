import * as i1 from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import * as i0 from '@angular/core';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { Subject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

var DynamicType;
(function (DynamicType) {
    DynamicType[DynamicType["Simple"] = 0] = "Simple";
    DynamicType[DynamicType["Sequence"] = 1] = "Sequence";
    DynamicType[DynamicType["SequenceEvent"] = 2] = "SequenceEvent";
})(DynamicType || (DynamicType = {}));
var MiscellaneousEventAction;
(function (MiscellaneousEventAction) {
    MiscellaneousEventAction["Beforeunload"] = "beforeunload";
    MiscellaneousEventAction["Timed"] = "timed"; // Must only be used in a sequence, either to progress the sequence after some time, or to trigger a sequence cancellation event. Not trackable.
})(MiscellaneousEventAction || (MiscellaneousEventAction = {}));
var MouseEventAction;
(function (MouseEventAction) {
    MouseEventAction["Click"] = "click";
    MouseEventAction["MouseOver"] = "mouseover";
    MouseEventAction["MouseOut"] = "mouseout";
    MouseEventAction["MouseDown"] = "mousedown";
    MouseEventAction["MouseUp"] = "mouseup";
})(MouseEventAction || (MouseEventAction = {}));
var KeyboardEventAction;
(function (KeyboardEventAction) {
    KeyboardEventAction["KeyPress"] = "keypress";
    KeyboardEventAction["KeyDown"] = "keydown";
    KeyboardEventAction["KeyUp"] = "keyup";
})(KeyboardEventAction || (KeyboardEventAction = {}));
class DynamicAnalyticsService {
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

/*
 * Public API Surface of dynamic-analytics
 */

/**
 * Generated bundle index. Do not edit.
 */

export { DynamicAnalyticsService, DynamicType, KeyboardEventAction, MiscellaneousEventAction, MouseEventAction };
//# sourceMappingURL=dynamic-analytics.mjs.map
