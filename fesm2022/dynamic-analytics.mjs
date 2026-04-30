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
    DynamicType[DynamicType["StepEvent"] = 2] = "StepEvent";
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
    zone;
    /** Emits tracked events (Simple events and completed trackable Sequences). Subscribe to forward events to your analytics backend. */
    onEvent = new Subject();
    /** Enable to log tracking activity to the console for debugging. */
    loggingEnabled = false;
    httpClient;
    versionFilterPredicate;
    translateTextContentFn;
    filteredEvents = [];
    sequences = [];
    // Delegation state
    delegatedHandlers = new Map();
    beforeUnloadHandler;
    isInitialized = false;
    // Sequence state
    sequenceTracker = {};
    timedEventForSequenceTracker = {};
    blockedSequenceIds = new Set();
    // Precomputed lookup maps for faster event dispatch (avoid filtering arrays on every DOM event)
    delegatedConfigsByEventAction = new Map();
    documentConfigsByEventAction = new Map();
    beforeUnloadConfigs = [];
    configsNeedingStatusSelectorCheck = new Map();
    // Reverse lookup maps: event ID → sequences that reference it as a step or cancel event
    sequencesByStepEventId = new Map();
    sequencesByCancelEventId = new Map();
    constructor(httpBackend, zone) {
        this.zone = zone;
        this.httpClient = new HttpClient(httpBackend);
    }
    /**
     * Initialize from a remote JSON configuration URL.
     * @param url URL to fetch the IEventConfigDefinition JSON from.
     * @param versionFilterPredicate Predicate that receives each config's minVersion/maxVersion and returns true if the config applies to the current app version.
     * @param translateTextContent Optional callback to translate textContents values at initialization time. Receives each textContents string and should return its translated equivalent (or the original string if no translation is needed).
     */
    initialize(url, versionFilterPredicate, translateTextContent) {
        this.versionFilterPredicate = versionFilterPredicate;
        this.translateTextContentFn = translateTextContent;
        this.initializeAnalyticsConfiguration(url);
    }
    /**
     * Initialize directly from an in-memory configuration object. Useful for development and testing.
     * @param eventConfigDefinition The configuration object containing event definitions.
     * @param versionFilterPredicate Predicate that receives each config's minVersion/maxVersion and returns true if the config applies to the current app version.
     * @param translateTextContent Optional callback to translate textContents values at initialization time. Receives each textContents string and should return its translated equivalent (or the original string if no translation is needed).
     */
    initializeWithConfig(eventConfigDefinition, versionFilterPredicate, translateTextContent) {
        this.versionFilterPredicate = versionFilterPredicate;
        this.translateTextContentFn = translateTextContent;
        this.initializeEventConfigDefinition(eventConfigDefinition);
    }
    /**
     * Tear down all event listeners and reset internal state.
     * Call before re-initializing or when the host component is destroyed.
     */
    destroy() {
        this.zone.runOutsideAngular(() => {
            for (const [eventName, handler] of this.delegatedHandlers.entries()) {
                document.removeEventListener(eventName, handler, true);
            }
            this.delegatedHandlers.clear();
            if (!_.isNil(this.beforeUnloadHandler)) {
                window.removeEventListener('beforeunload', this.beforeUnloadHandler);
                this.beforeUnloadHandler = undefined;
            }
        });
        this.isInitialized = false;
        this.translateTextContentFn = undefined;
        this.filteredEvents = [];
        this.sequences = [];
        this.delegatedConfigsByEventAction.clear();
        this.documentConfigsByEventAction.clear();
        this.configsNeedingStatusSelectorCheck.clear();
        this.beforeUnloadConfigs = [];
        this.sequencesByStepEventId.clear();
        this.sequencesByCancelEventId.clear();
        // Reset per-session tracking
        this.clearAllSequenceState();
    }
    initializeAnalyticsConfiguration(url) {
        this.getConfiguration$(url).subscribe(eventConfigDefinition => this.initializeEventConfigDefinition(eventConfigDefinition));
    }
    initializeEventConfigDefinition(eventConfigDefinition) {
        if (_.isEmpty(eventConfigDefinition?.configs)) {
            console.warn('No analytics configuration found');
            return;
        }
        const filteredEventConfigs = _.filter(eventConfigDefinition.configs, config => this.versionFilterPredicate(config.minVersion, config.maxVersion));
        this.validateEventConfigDefinition(filteredEventConfigs);
        this.filteredEvents = this.applyTextContentTranslations(filteredEventConfigs.flatMap(config => config.events));
        if (_.isEmpty(this.filteredEvents)) {
            console.warn('No analytics events found for this application version');
            return;
        }
        this.sequences = _.filter(this.filteredEvents, dynamicEvent => this.isSequence(dynamicEvent));
        this.buildReverseLookupMaps();
        this.precomputeListenerConfiguration();
        this.installDelegatedListeners();
        this.installBeforeUnloadListener();
        this.isInitialized = true;
    }
    applyTextContentTranslations(events) {
        if (_.isNil(this.translateTextContentFn)) {
            return events;
        }
        return events.map(event => {
            if (this.isDynamicEventWithSelector(event)) {
                const selectorEvent = event;
                if (!_.isNil(selectorEvent.textContents) && !_.isEmpty(selectorEvent.textContents)) {
                    return { ...event, textContents: this.translateTextContentFn(selectorEvent.textContents) };
                }
            }
            return event;
        });
    }
    precomputeListenerConfiguration() {
        this.delegatedConfigsByEventAction.clear();
        this.documentConfigsByEventAction.clear();
        this.configsNeedingStatusSelectorCheck.clear();
        // Precompute statusSelector presence so we don't branch or re-check string emptiness repeatedly.
        _.each(this.filteredEvents, dynamicEvent => {
            if (this.isDynamicEventWithSelector(dynamicEvent)) {
                const selectorEvent = dynamicEvent;
                if (!_.isNil(selectorEvent.statusSelector) && !_.isEmpty(selectorEvent.statusSelector)) {
                    this.configsNeedingStatusSelectorCheck.set(selectorEvent.id, selectorEvent.statusSelector);
                }
                if (selectorEvent.selector === 'document') {
                    const existingDocumentConfigs = this.documentConfigsByEventAction.get(selectorEvent.eventAction) ?? [];
                    existingDocumentConfigs.push(selectorEvent);
                    this.documentConfigsByEventAction.set(selectorEvent.eventAction, existingDocumentConfigs);
                }
                else {
                    const existingDelegatedConfigs = this.delegatedConfigsByEventAction.get(selectorEvent.eventAction) ?? [];
                    existingDelegatedConfigs.push(selectorEvent);
                    this.delegatedConfigsByEventAction.set(selectorEvent.eventAction, existingDelegatedConfigs);
                }
            }
        });
        // Cache beforeunload configs once (avoid filtering each time).
        this.beforeUnloadConfigs = this.filteredEvents.filter(dynamicEvent => this.isBeforeUnloadEventType(dynamicEvent));
    }
    buildReverseLookupMaps() {
        this.sequencesByStepEventId.clear();
        this.sequencesByCancelEventId.clear();
        _.each(this.sequences, sequence => {
            _.each(sequence.steps, stepId => {
                const existing = this.sequencesByStepEventId.get(stepId) ?? [];
                existing.push(sequence);
                this.sequencesByStepEventId.set(stepId, existing);
            });
            _.each(sequence.cancelledBy, cancelId => {
                const existing = this.sequencesByCancelEventId.get(cancelId) ?? [];
                existing.push(sequence);
                this.sequencesByCancelEventId.set(cancelId, existing);
            });
        });
    }
    installDelegatedListeners() {
        const requiredEventActions = new Set();
        for (const eventAction of this.delegatedConfigsByEventAction.keys()) {
            requiredEventActions.add(String(eventAction));
        }
        for (const eventAction of this.documentConfigsByEventAction.keys()) {
            requiredEventActions.add(String(eventAction));
        }
        // Install one capturing handler per event type.
        this.zone.runOutsideAngular(() => {
            requiredEventActions.forEach(eventActionName => {
                if (this.delegatedHandlers.has(eventActionName)) {
                    return;
                }
                const handler = (event) => {
                    this.handleDelegatedEvent(eventActionName, event);
                };
                this.delegatedHandlers.set(eventActionName, handler);
                // Capture helps when components stopPropagation in bubble phase.
                document.addEventListener(eventActionName, handler, true);
            });
        });
    }
    installBeforeUnloadListener() {
        if (_.isEmpty(this.beforeUnloadConfigs)) {
            return;
        }
        this.beforeUnloadHandler = () => {
            this.onBeforeUnload();
        };
        this.zone.runOutsideAngular(() => {
            window.addEventListener('beforeunload', this.beforeUnloadHandler);
        });
    }
    handleDelegatedEvent(eventAction, event) {
        if (!this.isInitialized) {
            return;
        }
        // 1) Handle "document" selector configs first.
        //    These are defined as selector === 'document' and should fire regardless of target.
        const documentConfigsForAction = this.documentConfigsByEventAction.get(eventAction) ?? [];
        for (const documentConfig of documentConfigsForAction) {
            this.getOnDynamicEventHandler(documentConfig)(event);
        }
        // 2) Handle element selector configs via delegation.
        const delegatedConfigsForAction = this.delegatedConfigsByEventAction.get(eventAction) ?? [];
        if (_.isEmpty(delegatedConfigsForAction)) {
            return;
        }
        const targetElement = event.target;
        if (_.isNil(targetElement)) {
            return;
        }
        for (const delegatedConfig of delegatedConfigsForAction) {
            const matchingElement = this.closestMatching(targetElement, delegatedConfig.selector);
            if (_.isNil(matchingElement)) {
                continue;
            }
            if (!this.isValidForTextContents(delegatedConfig, matchingElement)) {
                continue;
            }
            const isValidForStatusSelector = this.isValidForStatusSelector(delegatedConfig);
            if (!isValidForStatusSelector) {
                continue;
            }
            // Fire the configured analytics event, using the matched element as the "element context".
            // We pass match to keep your "element still matches selector" guard meaningful.
            this.getOnDynamicEventHandler(delegatedConfig, matchingElement)(event);
        }
    }
    isValidForStatusSelector(dynamicEvent) {
        const statusSelector = this.configsNeedingStatusSelectorCheck.get(dynamicEvent.id);
        if (_.isNil(statusSelector)) {
            return true;
        }
        const matchingStatusElements = document.querySelectorAll(statusSelector);
        if (_.isNil(matchingStatusElements) || matchingStatusElements.length === 0) {
            return false;
        }
        return true;
    }
    isValidForTextContents(dynamicEvent, element) {
        if (_.isNil(dynamicEvent.textContents) || _.isEmpty(dynamicEvent.textContents)) {
            return true;
        }
        const textContent = element.textContent?.trim() ?? '';
        return dynamicEvent.matchExactTextContents
            ? textContent === dynamicEvent.textContents
            : textContent.includes(dynamicEvent.textContents);
    }
    closestMatching(start, selector) {
        // Some selectors may be invalid; guard so one bad selector doesn't break everything.
        try {
            return start.closest(selector);
        }
        catch (error) {
            console.error('Invalid selector in dynamic analytics config:', selector, error);
            return null;
        }
    }
    getConfiguration$(url) {
        return this.httpClient
            .get(url)
            .pipe(catchError(error => {
            console.error('Unable to retrieve dynamic analytics configuration');
            console.error(error);
            return of(undefined);
        }));
    }
    getOnDynamicEventHandler(dynamicEvent, element) {
        return (event) => {
            // Only enforce "still matches" if we have element context and selector event.
            if (!_.isNil(element) && this.isDynamicEventWithSelector(dynamicEvent)) {
                const selectorToCheck = dynamicEvent.statusSelector ?? dynamicEvent.selector;
                const elementsMatchingSelector = document.querySelectorAll(selectorToCheck);
                const doesElementMatchConfig = this.doesElementMatchConfig(dynamicEvent, element, elementsMatchingSelector);
                if (!doesElementMatchConfig) {
                    this.log(`Element no longer matches selector. Cancelling event ${dynamicEvent.id}`);
                    return;
                }
            }
            this.onSimpleOrStepEvent(dynamicEvent, event);
        };
    }
    doesElementMatchConfig(dynamicEvent, element, elementsMatchingSelector) {
        if (_.isNil(dynamicEvent.statusSelector)) {
            return _.some(elementsMatchingSelector, matchingElement => matchingElement === element);
        }
        return elementsMatchingSelector.length > 0;
    }
    onSimpleOrStepEvent(dynamicEvent, event) {
        const isSimpleEvent = this.isSimpleEvent(dynamicEvent);
        if (isSimpleEvent) {
            const shouldTrackKeyboardEvent = this.shouldTrackKeyboardEvent(dynamicEvent, event);
            if (shouldTrackKeyboardEvent) {
                const additionalData = this.getAdditionalEventData(dynamicEvent);
                this.trackEvent(dynamicEvent, additionalData);
            }
        }
        if (isSimpleEvent || this.isStepEvent(dynamicEvent)) {
            this.onStepEvent(dynamicEvent, event);
        }
    }
    shouldTrackKeyboardEvent(dynamicEvent, event) {
        if (_.isNil(event)) {
            return true;
        }
        if (!this.isKeyboardEventType(dynamicEvent)) {
            return true;
        }
        const keyboardDynamicEvent = dynamicEvent;
        if (!keyboardDynamicEvent.isAlphaNumeric) {
            return true;
        }
        return this.isAlphaNumericKeyboardEvent(event);
    }
    onBeforeUnload() {
        if (_.isEmpty(this.beforeUnloadConfigs)) {
            return;
        }
        for (const beforeUnloadConfig of this.beforeUnloadConfigs) {
            this.getOnDynamicEventHandler(beforeUnloadConfig)();
        }
    }
    trackEvent(event, additionalData) {
        this.logEvent(event);
        // Re-enter Angular only when notifying subscribers.
        this.zone.run(() => {
            this.onEvent.next({
                ...event,
                additionalData
            });
        });
    }
    getAdditionalEventData(dynamicEvent) {
        let additionalData;
        if (!_.isEmpty(dynamicEvent.additionalDataSelectors)) {
            additionalData = dynamicEvent.additionalDataSelectors.map(selector => {
                const elementWithData = document.querySelector(selector);
                if (!_.isNil(elementWithData)) {
                    if (elementWithData instanceof HTMLInputElement) {
                        return elementWithData.value;
                    }
                    return elementWithData.innerHTML;
                }
                return undefined;
            });
        }
        return additionalData;
    }
    isAlphaNumericKeyboardEvent(event) {
        return (event?.key?.length ?? 0) === 1;
    }
    log(text) {
        if (this.loggingEnabled) {
            console.log(text);
        }
    }
    formatDynamicEventString(event) {
        const isSimpleEvent = this.isSimpleEvent(event);
        if (isSimpleEvent || this.isStepEvent(event)) {
            let logDetails = `${event.id}. ${event.message}`;
            if (!_.isNil(event.selector)) {
                logDetails += `. ${event.selector}`;
            }
            if (isSimpleEvent) {
                return `** Tracking simple event: ${logDetails}`;
            }
            else if (this.isStepEvent(event)) {
                return `Step event: ${logDetails} ${this.getSequenceProgress(event)}`;
            }
        }
        return `** Tracking sequence: ${event.id}. ${event.message}`;
    }
    getSequenceProgress(dynamicEvent) {
        const sequencesContainingThisEvent = this.sequencesByStepEventId.get(dynamicEvent.id) ?? [];
        const progress = [];
        _.each(sequencesContainingThisEvent, sequence => {
            if (_.includes(this.sequenceTracker[sequence.id], dynamicEvent.id)) {
                progress.push(`Sequence ${sequence.id} = ${this.sequenceTracker[sequence.id].length}/${sequence.steps.length}`);
            }
        });
        return progress.join(', ');
    }
    onStepEvent(dynamicEvent, event) {
        const sequencesCancelledByThisEvent = this.sequencesByCancelEventId.get(dynamicEvent.id) ?? [];
        if (!_.isEmpty(sequencesCancelledByThisEvent)) {
            const resetSequences = [];
            _.each(sequencesCancelledByThisEvent, sequence => {
                const tracker = (this.sequenceTracker[sequence.id] = this.sequenceTracker[sequence.id] ?? []);
                if (!_.isEmpty(tracker) &&
                    _.includes(sequence.cancelledBy, dynamicEvent.id) &&
                    !this.doesEventTargetTriggerStepEvent(sequence, event)) {
                    resetSequences.push(sequence);
                    this.resetSequence(sequence);
                    this.blockedSequenceIds.add(sequence.id);
                    setTimeout(() => {
                        this.blockedSequenceIds.delete(sequence.id);
                    }, 10);
                }
            });
            if (!_.isEmpty(resetSequences)) {
                this.log(`Sequence reset by event ${dynamicEvent.id}: ${resetSequences.map(sequence => sequence.id).join(',')}`);
            }
        }
        const sequencesContainingThisEvent = (this.sequencesByStepEventId.get(dynamicEvent.id) ?? [])
            .filter(sequence => !this.blockedSequenceIds.has(sequence.id));
        _.each(sequencesContainingThisEvent, sequence => {
            setTimeout(() => {
                this.blockedSequenceIds.delete(sequence.id);
            }, 10);
            const tracker = this.sequenceTracker[sequence.id] = this.sequenceTracker[sequence.id] ?? [];
            if (sequence.steps[tracker.length] === dynamicEvent.id) {
                this.log(`Adding event ${dynamicEvent.id} to Sequence ${sequence.id} tracker`);
                tracker.push(dynamicEvent.id);
                this.blockedSequenceIds.add(sequence.id);
            }
            if (tracker.length === sequence.steps.length) {
                this.log(`Sequence ${sequence.id} complete`);
                this.trackAndResetSequence(sequence);
                this.onStepEvent(sequence);
            }
            else {
                const nextEventIdInSequence = sequence.steps[tracker.length];
                const nextEventInSequence = _.find(this.filteredEvents, { id: nextEventIdInSequence });
                if (_.isNil(nextEventInSequence)) {
                    console.error(`Next event in sequence not found. Incorrect Id specified? Next event id ${nextEventIdInSequence}. Sequence ${sequence.id}`);
                    this.resetSequence(sequence);
                    return;
                }
                if (this.isTimedEvent(nextEventInSequence)) {
                    this.startTimedEventTimerForSequence(nextEventInSequence, sequence);
                }
                if (tracker.length === 1 && !_.isNil(sequence.timeout)) {
                    this.startSequenceTimeout(sequence);
                }
            }
        });
    }
    startTimedEventTimerForSequence(dynamicEvent, sequence) {
        const timer = dynamicEvent.timeout;
        if (timer <= 0) {
            throw new Error(`Timeout value must be greater than 0 for event ${dynamicEvent.id}`);
        }
        const tracker = (this.timedEventForSequenceTracker[sequence.id] = this.timedEventForSequenceTracker[sequence.id] ?? {});
        if (!_.isNil(tracker[dynamicEvent.id])) {
            throw new Error(`Timer event already exists for event ${dynamicEvent.id} in sequence ${sequence.id}`);
        }
        this.log(`Timer starting for event ${dynamicEvent.id} in sequence ${sequence.id}`);
        tracker[dynamicEvent.id] = setTimeout(() => {
            delete tracker[dynamicEvent.id];
            this.log(`Timer complete for event ${dynamicEvent.id} in sequence ${sequence.id}`);
            this.onSimpleOrStepEvent(dynamicEvent);
        }, timer);
    }
    resetTimersForSequence(sequence) {
        const tracker = this.timedEventForSequenceTracker[sequence.id];
        if (!_.isNil(tracker)) {
            _.each(tracker, timeoutId => clearTimeout(timeoutId));
        }
        delete this.timedEventForSequenceTracker[sequence.id];
    }
    startSequenceTimeout(sequence) {
        const tracker = this.timedEventForSequenceTracker[sequence.id] = this.timedEventForSequenceTracker[sequence.id] ?? {};
        tracker[sequence.id] = setTimeout(() => {
            if (!_.isEmpty(this.sequenceTracker[sequence.id])) {
                this.log(`Sequence ${sequence.id} timed out`);
                this.resetSequence(sequence);
            }
        }, sequence.timeout);
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
    logEvent(event) {
        if (!this.loggingEnabled) {
            return;
        }
        if (this.isSequence(event) && !event.isTrackable) {
            return;
        }
        this.log(this.formatDynamicEventString(event));
    }
    // Type guards
    isStepEvent(event) {
        return event.dynamicType === DynamicType.StepEvent;
    }
    isSimpleEvent(event) {
        return event.dynamicType === DynamicType.Simple;
    }
    isBeforeUnloadEventType(event) {
        return (this.isSimpleEvent(event) || this.isStepEvent(event)) && (event).eventAction === MiscellaneousEventAction.Beforeunload;
    }
    isKeyboardEventType(event) {
        return (this.isSimpleEvent(event) || this.isStepEvent(event)) &&
            Object.values(KeyboardEventAction).includes(event.eventAction);
    }
    isDynamicEventWithSelector(event) {
        return (this.isSimpleEvent(event) || this.isStepEvent(event)) && (event).selector !== undefined;
    }
    isSequence(event) {
        return event.dynamicType === DynamicType.Sequence;
    }
    isTimedEvent(event) {
        return (this.isSimpleEvent(event) || this.isStepEvent(event)) && (event).eventAction === MiscellaneousEventAction.Timed;
    }
    doesEventTargetTriggerStepEvent(sequence, event) {
        if (_.isNil(event)) {
            return false;
        }
        const tracker = this.sequenceTracker[sequence.id];
        if (_.isEmpty(tracker)) {
            return false;
        }
        const otherStepEventId = sequence.steps[tracker.length - 1];
        const stepEvent = _.find(this.filteredEvents, dynamicEvent => dynamicEvent.id === otherStepEventId);
        if (_.isNil(stepEvent) || !this.isDynamicEventWithSelector(stepEvent)) {
            return false;
        }
        const elementsMatchingSelector = document.querySelectorAll(stepEvent.statusSelector ?? stepEvent.selector);
        const target = event.target;
        return _.some(elementsMatchingSelector, element => element === target || element.contains(target));
    }
    validateEventConfigDefinition(filteredEventConfigs) {
        const uniqueEventIds = new Set();
        const uniqueSequenceStepEventIds = new Set();
        const uniqueCancelEventIds = new Set();
        _.each(filteredEventConfigs, config => {
            _.each(config.events, event => {
                if (uniqueEventIds.has(event.id)) {
                    throw new Error('Event ids must be unique');
                }
                uniqueEventIds.add(event.id);
                if (this.isSequence(event)) {
                    if (event.steps.length < 2) {
                        throw new Error('Sequences must have at least 2 event ids');
                    }
                    event.steps.forEach(id => {
                        if (id === event.id) {
                            throw new Error('Sequences cannot reference their own id as a step event');
                        }
                        uniqueSequenceStepEventIds.add(id);
                    });
                    event.cancelledBy.forEach(id => {
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
                    throw new Error('Additional data must not be provided in the configuration. Use `additionalDataSelectors` to allow the service to find additional data in the DOM at event-time');
                }
                if (!_.isNil(event.additionalDataSelectors) && _.some(event.additionalDataSelectors, (selector) => _.isEmpty(selector))) {
                    throw new Error('Additional data selectors cannot be an empty string');
                }
                if (this.isDynamicEventWithSelector(event) && !_.isNil(event.selector) && _.isEmpty(event.selector)) {
                    throw new Error('Selector cannot be an empty string');
                }
                if (this.isDynamicEventWithSelector(event) && event.matchExactTextContents === true && (_.isNil(event.textContents) || _.isEmpty(event.textContents))) {
                    throw new Error('matchExactTextContents can only be true when textContents is a non-empty string');
                }
            });
        });
        uniqueSequenceStepEventIds.forEach(id => {
            if (!uniqueEventIds.has(id)) {
                throw new Error('Step events must exist');
            }
        });
        uniqueCancelEventIds.forEach(id => {
            if (!uniqueEventIds.has(id)) {
                throw new Error('Cancel events must exist');
            }
        });
    }
    clearAllSequenceState() {
        for (const sequenceIdKey of Object.keys(this.sequenceTracker)) {
            delete this.sequenceTracker[Number(sequenceIdKey)];
        }
        for (const sequenceTimerKey of Object.keys(this.timedEventForSequenceTracker)) {
            const tracker = this.timedEventForSequenceTracker[Number(sequenceTimerKey)];
            if (!_.isNil(tracker)) {
                _.each(tracker, timeoutId => clearTimeout(timeoutId));
            }
            delete this.timedEventForSequenceTracker[Number(sequenceTimerKey)];
        }
        this.blockedSequenceIds.clear();
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

export { DynamicAnalyticsService, DynamicType, KeyboardEventAction, MiscellaneousEventAction, MouseEventAction };
//# sourceMappingURL=dynamic-analytics.mjs.map
