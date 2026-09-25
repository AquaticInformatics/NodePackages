"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// projects/dynamic-analytics-core/src/react/public-api.ts
var public_api_exports = {};
__export(public_api_exports, {
  useDynamicAnalytics: () => useDynamicAnalytics
});
module.exports = __toCommonJS(public_api_exports);

// projects/dynamic-analytics-core/src/react/dynamic-analytics-react.ts
var import_react = require("react");

// projects/dynamic-analytics-core/src/lib/dynamic-analytics-core.ts
var _ = __toESM(require("lodash"));
var import_rxjs = require("rxjs");
var import_operators = require("rxjs/operators");
var KeyboardEventAction = /* @__PURE__ */ ((KeyboardEventAction2) => {
  KeyboardEventAction2["KeyPress"] = "keypress";
  KeyboardEventAction2["KeyDown"] = "keydown";
  KeyboardEventAction2["KeyUp"] = "keyup";
  return KeyboardEventAction2;
})(KeyboardEventAction || {});
function defaultConfigLoader(url) {
  return (0, import_rxjs.from)(
    fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response.json();
    })
  );
}
var DynamicAnalyticsCore = class {
  /** Emits tracked events (Simple events and completed trackable Sequences) as well as failures (when `errorTrackingEnabled` is true). Subscribe to forward events to your analytics backend. */
  onEvent = new import_rxjs.Subject();
  /** Enable to log tracking activity to the console for debugging. */
  loggingEnabled = false;
  /** Enable to emit failures (e.g. invalid configurations or unexpected runtime errors) via `onEvent` so they can be tracked in your analytics system. */
  errorTrackingEnabled = true;
  versionFilterPredicate;
  translateTextContentFn;
  filteredEvents = [];
  sequences = [];
  // Delegation state
  delegatedHandlers = /* @__PURE__ */ new Map();
  beforeUnloadHandler;
  isInitialized = false;
  // Sequence state
  sequenceTracker = {};
  timedEventForSequenceTracker = {};
  blockedSequenceIds = /* @__PURE__ */ new Set();
  // Precomputed lookup maps for faster event dispatch (avoid filtering arrays on every DOM event)
  delegatedConfigsByEventAction = /* @__PURE__ */ new Map();
  documentConfigsByEventAction = /* @__PURE__ */ new Map();
  beforeUnloadConfigs = [];
  configsNeedingStatusSelectorCheck = /* @__PURE__ */ new Map();
  // Reverse lookup maps: event ID → sequences that reference it as a step or cancel event
  sequencesByStepEventId = /* @__PURE__ */ new Map();
  sequencesByCancelEventId = /* @__PURE__ */ new Map();
  configLoader;
  runOutsideZone;
  runInZone;
  constructor(options = {}) {
    this.configLoader = options.configLoader ?? defaultConfigLoader;
    this.runOutsideZone = options.runOutsideZone ?? ((fn) => fn());
    this.runInZone = options.runInZone ?? ((fn) => fn());
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
    this.runOutsideZone(() => {
      for (const [eventName, handler] of this.delegatedHandlers.entries()) {
        document.removeEventListener(eventName, handler, true);
      }
      this.delegatedHandlers.clear();
      if (!_.isNil(this.beforeUnloadHandler)) {
        window.removeEventListener("beforeunload", this.beforeUnloadHandler);
        this.beforeUnloadHandler = void 0;
      }
    });
    this.isInitialized = false;
    this.translateTextContentFn = void 0;
    this.filteredEvents = [];
    this.sequences = [];
    this.delegatedConfigsByEventAction.clear();
    this.documentConfigsByEventAction.clear();
    this.configsNeedingStatusSelectorCheck.clear();
    this.beforeUnloadConfigs = [];
    this.sequencesByStepEventId.clear();
    this.sequencesByCancelEventId.clear();
    this.clearAllSequenceState();
  }
  initializeAnalyticsConfiguration(url) {
    this.getConfiguration$(url).subscribe((eventConfigDefinition) => this.initializeEventConfigDefinition(eventConfigDefinition));
  }
  initializeEventConfigDefinition(eventConfigDefinition) {
    if (_.isEmpty(eventConfigDefinition?.configs)) {
      console.warn("No analytics configuration found");
      return;
    }
    const filteredEventConfigs = _.filter(
      eventConfigDefinition.configs,
      (config) => this.versionFilterPredicate(config.minVersion, config.maxVersion)
    );
    this.validateEventConfigDefinition(filteredEventConfigs);
    this.filteredEvents = this.applyTextContentTranslations(filteredEventConfigs.flatMap((config) => config.events));
    if (_.isEmpty(this.filteredEvents)) {
      console.warn("No analytics events found for this application version");
      return;
    }
    this.sequences = _.filter(this.filteredEvents, (dynamicEvent) => this.isSequence(dynamicEvent));
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
    return events.map((event) => {
      if (this.isDynamicEventWithSelector(event)) {
        const selectorEvent = event;
        const hasTextContents = !_.isNil(selectorEvent.textContents) && !_.isEmpty(selectorEvent.textContents);
        const hasStatusTextContents = !_.isNil(selectorEvent.guardSelectorTextContents) && !_.isEmpty(selectorEvent.guardSelectorTextContents);
        if (hasTextContents || hasStatusTextContents) {
          const translated = { ...event };
          if (hasTextContents) {
            translated.textContents = this.translateTextContentFn(selectorEvent.textContents);
          }
          if (hasStatusTextContents) {
            translated.guardSelectorTextContents = this.translateTextContentFn(selectorEvent.guardSelectorTextContents);
          }
          return translated;
        }
      }
      return event;
    });
  }
  precomputeListenerConfiguration() {
    this.delegatedConfigsByEventAction.clear();
    this.documentConfigsByEventAction.clear();
    this.configsNeedingStatusSelectorCheck.clear();
    _.each(this.filteredEvents, (dynamicEvent) => {
      if (this.isDynamicEventWithSelector(dynamicEvent)) {
        const selectorEvent = dynamicEvent;
        if (!_.isNil(selectorEvent.guardSelector) && !_.isEmpty(selectorEvent.guardSelector)) {
          this.configsNeedingStatusSelectorCheck.set(selectorEvent.id, selectorEvent.guardSelector);
        }
        if (selectorEvent.selector === "document") {
          const existingDocumentConfigs = this.documentConfigsByEventAction.get(selectorEvent.eventAction) ?? [];
          existingDocumentConfigs.push(selectorEvent);
          this.documentConfigsByEventAction.set(selectorEvent.eventAction, existingDocumentConfigs);
        } else {
          const existingDelegatedConfigs = this.delegatedConfigsByEventAction.get(selectorEvent.eventAction) ?? [];
          existingDelegatedConfigs.push(selectorEvent);
          this.delegatedConfigsByEventAction.set(selectorEvent.eventAction, existingDelegatedConfigs);
        }
      }
    });
    this.beforeUnloadConfigs = this.filteredEvents.filter((dynamicEvent) => this.isBeforeUnloadEventType(dynamicEvent));
  }
  buildReverseLookupMaps() {
    this.sequencesByStepEventId.clear();
    this.sequencesByCancelEventId.clear();
    _.each(this.sequences, (sequence) => {
      _.each(sequence.steps, (stepId) => {
        const existing = this.sequencesByStepEventId.get(stepId) ?? [];
        existing.push(sequence);
        this.sequencesByStepEventId.set(stepId, existing);
      });
      _.each(sequence.cancelledBy, (cancelId) => {
        const existing = this.sequencesByCancelEventId.get(cancelId) ?? [];
        existing.push(sequence);
        this.sequencesByCancelEventId.set(cancelId, existing);
      });
    });
  }
  installDelegatedListeners() {
    const requiredEventActions = /* @__PURE__ */ new Set();
    for (const eventAction of this.delegatedConfigsByEventAction.keys()) {
      requiredEventActions.add(String(eventAction));
    }
    for (const eventAction of this.documentConfigsByEventAction.keys()) {
      requiredEventActions.add(String(eventAction));
    }
    this.runOutsideZone(() => {
      requiredEventActions.forEach((eventActionName) => {
        if (this.delegatedHandlers.has(eventActionName)) {
          return;
        }
        const handler = (event) => {
          this.handleDelegatedEvent(eventActionName, event);
        };
        this.delegatedHandlers.set(eventActionName, handler);
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
    this.runOutsideZone(() => {
      window.addEventListener("beforeunload", this.beforeUnloadHandler);
    });
  }
  handleDelegatedEvent(eventAction, event) {
    if (!this.isInitialized) {
      return;
    }
    const documentConfigsForAction = this.documentConfigsByEventAction.get(eventAction) ?? [];
    for (const documentConfig of documentConfigsForAction) {
      this.getOnDynamicEventHandler(documentConfig)(event);
    }
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
      this.getOnDynamicEventHandler(delegatedConfig, matchingElement)(event);
    }
  }
  isValidForStatusSelector(dynamicEvent) {
    const guardSelector = this.configsNeedingStatusSelectorCheck.get(dynamicEvent.id);
    if (_.isNil(guardSelector)) {
      return true;
    }
    const matchingStatusElements = document.querySelectorAll(guardSelector);
    if (_.isNil(matchingStatusElements) || matchingStatusElements.length === 0) {
      return false;
    }
    if (!_.isNil(dynamicEvent.guardSelectorTextContents) && !_.isEmpty(dynamicEvent.guardSelectorTextContents)) {
      const hasTextMatch = Array.from(matchingStatusElements).some(
        (element) => this.elementMatchesText(element, dynamicEvent.guardSelectorTextContents, !!dynamicEvent.matchExactGuardSelectorTextContents)
      );
      if (!hasTextMatch) {
        return false;
      }
    }
    return true;
  }
  elementMatchesText(element, text, exactMatch) {
    const trimmed = element.textContent?.trim() ?? "";
    return exactMatch ? trimmed === text : trimmed.includes(text);
  }
  isValidForTextContents(dynamicEvent, element) {
    if (_.isNil(dynamicEvent.textContents) || _.isEmpty(dynamicEvent.textContents)) {
      return true;
    }
    return this.elementMatchesText(element, dynamicEvent.textContents, !!dynamicEvent.matchExactTextContents);
  }
  closestMatching(start, selector) {
    try {
      return start.closest(selector);
    } catch (error) {
      this.trackError(`Invalid selector in dynamic analytics config: ${selector}`, error);
      return null;
    }
  }
  getConfiguration$(url) {
    return this.configLoader(url).pipe(
      (0, import_operators.catchError)((error) => {
        this.trackError("Unable to retrieve dynamic analytics configuration", error);
        return (0, import_rxjs.of)(void 0);
      })
    );
  }
  getOnDynamicEventHandler(dynamicEvent, element) {
    return (event) => {
      if (!_.isNil(element) && this.isDynamicEventWithSelector(dynamicEvent)) {
        const selectorToCheck = dynamicEvent.guardSelector ?? dynamicEvent.selector;
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
    if (_.isNil(dynamicEvent.guardSelector)) {
      return _.some(elementsMatchingSelector, (matchingElement) => matchingElement === element);
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
    const pressedKey = event?.key;
    if (!_.isNil(keyboardDynamicEvent.keys) && !_.isEmpty(keyboardDynamicEvent.keys)) {
      const allowedKeys = keyboardDynamicEvent.keys.split("|");
      if (!allowedKeys.includes(pressedKey)) {
        return false;
      }
    }
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
    this.runInZone(() => {
      this.onEvent.next({
        ...event,
        additionalData
      });
    });
  }
  getAdditionalEventData(dynamicEvent) {
    let additionalData;
    if (!_.isEmpty(dynamicEvent.additionalDataSelectors)) {
      additionalData = dynamicEvent.additionalDataSelectors.map((selector) => {
        const elementWithData = document.querySelector(selector);
        if (!_.isNil(elementWithData)) {
          if (elementWithData instanceof HTMLInputElement) {
            return elementWithData.value;
          }
          return elementWithData.innerHTML;
        }
        return void 0;
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
  /** Logs a failure to the console and, when `errorTrackingEnabled` is true, emits it via `onEvent` so consuming applications can track it in their analytics system. */
  trackError(message, error) {
    console.error(message, error);
    if (!this.errorTrackingEnabled) {
      return;
    }
    this.runInZone(() => {
      this.onEvent.next({ id: -1, dynamicType: 3 /* Error */, message, error });
    });
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
      } else if (this.isStepEvent(event)) {
        return `Step event: ${logDetails} ${this.getSequenceProgress(event)}`;
      }
    }
    return `** Tracking sequence: ${event.id}. ${event.message}`;
  }
  getSequenceProgress(dynamicEvent) {
    const sequencesContainingThisEvent = this.sequencesByStepEventId.get(dynamicEvent.id) ?? [];
    const progress = [];
    _.each(sequencesContainingThisEvent, (sequence) => {
      if (_.includes(this.sequenceTracker[sequence.id], dynamicEvent.id)) {
        progress.push(`Sequence ${sequence.id} = ${this.sequenceTracker[sequence.id].length}/${sequence.steps.length}`);
      }
    });
    return progress.join(", ");
  }
  onStepEvent(dynamicEvent, event) {
    const sequencesCancelledByThisEvent = this.sequencesByCancelEventId.get(dynamicEvent.id) ?? [];
    if (!_.isEmpty(sequencesCancelledByThisEvent)) {
      const resetSequences = [];
      _.each(sequencesCancelledByThisEvent, (sequence) => {
        const tracker = this.sequenceTracker[sequence.id] = this.sequenceTracker[sequence.id] ?? [];
        if (!_.isEmpty(tracker) && _.includes(sequence.cancelledBy, dynamicEvent.id) && !this.doesEventTargetTriggerStepEvent(sequence, event)) {
          resetSequences.push(sequence);
          this.resetSequence(sequence);
          this.blockedSequenceIds.add(sequence.id);
          setTimeout(() => {
            this.blockedSequenceIds.delete(sequence.id);
          }, 10);
        }
      });
      if (!_.isEmpty(resetSequences)) {
        this.log(`Sequence reset by event ${dynamicEvent.id}: ${resetSequences.map((sequence) => sequence.id).join(",")}`);
      }
    }
    const sequencesContainingThisEvent = (this.sequencesByStepEventId.get(dynamicEvent.id) ?? []).filter((sequence) => !this.blockedSequenceIds.has(sequence.id));
    _.each(sequencesContainingThisEvent, (sequence) => {
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
      } else {
        const nextEventIdInSequence = sequence.steps[tracker.length];
        const nextEventInSequence = _.find(this.filteredEvents, { id: nextEventIdInSequence });
        if (_.isNil(nextEventInSequence)) {
          this.trackError(`Next event in sequence not found. Incorrect Id specified? Next event id ${nextEventIdInSequence}. Sequence ${sequence.id}`);
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
    const tracker = this.timedEventForSequenceTracker[sequence.id] = this.timedEventForSequenceTracker[sequence.id] ?? {};
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
      _.each(tracker, (timeoutId) => clearTimeout(timeoutId));
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
    return event.dynamicType === 2 /* StepEvent */;
  }
  isSimpleEvent(event) {
    return event.dynamicType === 0 /* Simple */;
  }
  isBeforeUnloadEventType(event) {
    return (this.isSimpleEvent(event) || this.isStepEvent(event)) && event.eventAction === "beforeunload" /* Beforeunload */;
  }
  isKeyboardEventType(event) {
    return (this.isSimpleEvent(event) || this.isStepEvent(event)) && Object.values(KeyboardEventAction).includes(event.eventAction);
  }
  isDynamicEventWithSelector(event) {
    return (this.isSimpleEvent(event) || this.isStepEvent(event)) && event.selector !== void 0;
  }
  isSequence(event) {
    return event.dynamicType === 1 /* Sequence */;
  }
  isTimedEvent(event) {
    return (this.isSimpleEvent(event) || this.isStepEvent(event)) && event.eventAction === "timed" /* Timed */;
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
    const stepEvent = _.find(this.filteredEvents, (dynamicEvent) => dynamicEvent.id === otherStepEventId);
    if (_.isNil(stepEvent) || !this.isDynamicEventWithSelector(stepEvent)) {
      return false;
    }
    const elementsMatchingSelector = document.querySelectorAll(stepEvent.guardSelector ?? stepEvent.selector);
    const target = event.target;
    return _.some(elementsMatchingSelector, (element) => element === target || element.contains(target));
  }
  validateEventConfigDefinition(filteredEventConfigs) {
    const uniqueEventIds = /* @__PURE__ */ new Set();
    const uniqueSequenceStepEventIds = /* @__PURE__ */ new Set();
    const uniqueCancelEventIds = /* @__PURE__ */ new Set();
    _.each(filteredEventConfigs, (config) => {
      _.each(config.events, (event) => {
        if (uniqueEventIds.has(event.id)) {
          throw new Error("Event ids must be unique");
        }
        uniqueEventIds.add(event.id);
        if (this.isSequence(event)) {
          if (event.steps.length < 2) {
            throw new Error("Sequences must have at least 2 event ids");
          }
          event.steps.forEach((id) => {
            if (id === event.id) {
              throw new Error("Sequences cannot reference their own id as a step event");
            }
            uniqueSequenceStepEventIds.add(id);
          });
          event.cancelledBy.forEach((id) => {
            if (id === event.id) {
              throw new Error("Sequences cannot reference their own id as a cancel event");
            }
            uniqueCancelEventIds.add(id);
          });
        }
        if (this.isTimedEvent(event) && (event.timeout <= 0 || _.isNaN(event.timeout))) {
          throw new Error("Timeout event must be a number greater than zero");
        }
        if (!_.isNil(event.additionalData)) {
          throw new Error("Additional data must not be provided in the configuration. Use `additionalDataSelectors` to allow the service to find additional data in the DOM at event-time");
        }
        if (!_.isNil(event.additionalDataSelectors) && _.some(event.additionalDataSelectors, (selector) => _.isEmpty(selector))) {
          throw new Error("Additional data selectors cannot be an empty string");
        }
        if (this.isDynamicEventWithSelector(event) && !_.isNil(event.selector) && _.isEmpty(event.selector)) {
          throw new Error("Selector cannot be an empty string");
        }
        if (this.isDynamicEventWithSelector(event) && event.matchExactTextContents === true && (_.isNil(event.textContents) || _.isEmpty(event.textContents))) {
          throw new Error("matchExactTextContents can only be true when textContents is a non-empty string");
        }
        if (this.isDynamicEventWithSelector(event) && !_.isNil(event.guardSelectorTextContents) && !_.isEmpty(event.guardSelectorTextContents) && (_.isNil(event.guardSelector) || _.isEmpty(event.guardSelector))) {
          throw new Error("guardSelectorTextContents requires a non-empty guardSelector");
        }
        if (this.isDynamicEventWithSelector(event) && event.matchExactGuardSelectorTextContents === true && (_.isNil(event.guardSelectorTextContents) || _.isEmpty(event.guardSelectorTextContents))) {
          throw new Error("matchExactGuardSelectorTextContents can only be true when guardSelectorTextContents is a non-empty string");
        }
        if (!_.isNil(event.keys)) {
          if (!this.isKeyboardEventType(event)) {
            throw new Error("keys can only be specified for keyboard event types");
          }
          if (_.isEmpty(event.keys)) {
            throw new Error("keys cannot be an empty string");
          }
        }
      });
    });
    uniqueSequenceStepEventIds.forEach((id) => {
      if (!uniqueEventIds.has(id)) {
        throw new Error("Step events must exist");
      }
    });
    uniqueCancelEventIds.forEach((id) => {
      if (!uniqueEventIds.has(id)) {
        throw new Error("Cancel events must exist");
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
        _.each(tracker, (timeoutId) => clearTimeout(timeoutId));
      }
      delete this.timedEventForSequenceTracker[Number(sequenceTimerKey)];
    }
    this.blockedSequenceIds.clear();
  }
};

// projects/dynamic-analytics-core/src/react/dynamic-analytics-react.ts
function useDynamicAnalytics(options = {}) {
  const { onEvent, ...coreOptions } = options;
  const analytics = (0, import_react.useMemo)(() => new DynamicAnalyticsCore(coreOptions), []);
  (0, import_react.useEffect)(() => {
    if (!onEvent) {
      return void 0;
    }
    const subscription = analytics.onEvent.subscribe(onEvent);
    return () => subscription.unsubscribe();
  }, [analytics, onEvent]);
  (0, import_react.useEffect)(() => {
    return () => analytics.destroy();
  }, [analytics]);
  return analytics;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  useDynamicAnalytics
});
//# sourceMappingURL=react.cjs.map