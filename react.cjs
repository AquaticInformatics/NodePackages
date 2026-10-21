"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// projects/dynamic-analytics-core/src/react/public-api.ts
var public_api_exports = {};
__export(public_api_exports, {
  useDynamicAnalytics: () => useDynamicAnalytics
});
module.exports = __toCommonJS(public_api_exports);

// projects/dynamic-analytics-core/src/react/dynamic-analytics-react.ts
var import_react = require("react");

// projects/dynamic-analytics-core/src/lib/utils.ts
function isNil(value) {
  return value === null || value === void 0;
}
function isString(value) {
  return typeof value === "string";
}
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}
function isEmpty(value) {
  if (isNil(value)) {
    return true;
  }
  if (isString(value) || Array.isArray(value)) {
    return value.length === 0;
  }
  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return true;
}
function each(collection, iteratee) {
  if (isNil(collection)) {
    return;
  }
  const items = Array.isArray(collection) ? collection : Object.values(collection);
  items.forEach((item) => iteratee(item));
}
function filter(collection, predicate) {
  return collection?.filter((item) => predicate(item)) ?? [];
}
function find(collection, predicate) {
  return collection?.find((item) => predicate(item));
}
function some(collection, predicate) {
  return isNil(collection) ? false : Array.prototype.some.call(collection, (item) => predicate(item));
}
function includes(collection, value) {
  return collection?.includes(value) ?? false;
}

// projects/dynamic-analytics-core/src/lib/dynamic-analytics-core.ts
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
  devTools = {
    injectConfig: (eventConfigDefinition) => this.injectConfig(eventConfigDefinition)
  };
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
   *
   * This is the primary way to initialize the service in production: it fetches the
   * configuration remotely (via `configLoader`) so it can be updated independently of your
   * application's deployment. For loading an in-memory config directly (e.g. in unit tests or
   * while authoring/validating a configuration before deployment), use `initializeWithConfig()`
   * instead.
   * @param url URL to fetch the IEventConfigDefinition JSON from.
   * @param versionFilterPredicate Predicate that receives each config's minVersion/maxVersion and returns true if the config applies to the current app version.
   * @param translateTextContent Optional callback to translate textContents values at initialization time. Receives each textContents string and should return its translated equivalent (or the original string if no translation is needed).
   */
  initialize(url, versionFilterPredicate, translateTextContent) {
    this.versionFilterPredicate = versionFilterPredicate;
    this.translateTextContentFn = translateTextContent;
    this.registerDevTools();
    this.initializeAnalyticsConfiguration(url);
  }
  /**
   * Initialize directly from an in-memory configuration object.
   *
   * Intended for unit tests and for validating a configuration before deployment (e.g. previewing
   * it in the configurator app) — not for production use. Production apps should use `initialize()`
   * to load the configuration from a URL instead, so it can be updated without a redeploy.
   * @param eventConfigDefinition The configuration object containing event definitions.
   * @param versionFilterPredicate Predicate that receives each config's minVersion/maxVersion and returns true if the config applies to the current app version.
   * @param translateTextContent Optional callback to translate textContents values at initialization time. Receives each textContents string and should return its translated equivalent (or the original string if no translation is needed).
   */
  initializeWithConfig(eventConfigDefinition, versionFilterPredicate, translateTextContent) {
    this.versionFilterPredicate = versionFilterPredicate;
    this.translateTextContentFn = translateTextContent;
    this.registerDevTools();
    this.initializeEventConfigDefinition(eventConfigDefinition);
  }
  /**
   * Tear down all event listeners and reset internal state.
   * Call before re-initializing or when the host component is destroyed.
   */
  destroy() {
    this.unregisterDevTools();
    this.resetState();
  }
  /**
   * Replace the currently loaded configuration with the given one. The new configuration goes
   * through the same version filtering and validation as a normal load. If validation fails the
   * error is thrown and the existing configuration and listeners are left untouched.
   *
   * Also exposed on `window.dynamicAnalytics.injectConfig()` so developers can call it from the
   * browser dev tools.
   * @param eventConfigDefinition The configuration object containing event definitions.
   * @returns true if the configuration was replaced, false if it contained no usable events (in which case the existing configuration is kept).
   */
  replaceConfig(eventConfigDefinition) {
    this.versionFilterPredicate ??= () => true;
    const validatedEvents = this.buildValidatedEvents(eventConfigDefinition);
    if (isNil(validatedEvents)) {
      return false;
    }
    const translateTextContent = this.translateTextContentFn;
    this.resetState();
    this.translateTextContentFn = translateTextContent;
    this.applyValidatedEvents(validatedEvents);
    this.registerDevTools();
    return true;
  }
  registerDevTools() {
    if (typeof window === "undefined") {
      return;
    }
    window.dynamicAnalytics = this.devTools;
  }
  unregisterDevTools() {
    if (typeof window !== "undefined" && window.dynamicAnalytics === this.devTools) {
      window.dynamicAnalytics = void 0;
    }
  }
  injectConfig(eventConfigDefinitionOrJson) {
    try {
      const eventConfigDefinition = this.parseInjectedConfig(eventConfigDefinitionOrJson);
      if (this.replaceConfig(eventConfigDefinition)) {
        console.info("Dynamic analytics configuration replaced.");
      }
    } catch (error) {
      this.trackError("Unable to inject dynamic analytics configuration", error);
      throw error;
    }
  }
  /** Parses a JSON string (which may be malformed) or passes an already-parsed object through, ensuring the result is an object. */
  parseInjectedConfig(eventConfigDefinitionOrJson) {
    let parsedConfig = eventConfigDefinitionOrJson;
    if (isString(eventConfigDefinitionOrJson)) {
      try {
        parsedConfig = JSON.parse(eventConfigDefinitionOrJson);
      } catch (error) {
        throw new Error(`Injected configuration is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!isPlainObject(parsedConfig)) {
      throw new Error("Injected configuration must be a JSON object or a JSON string describing one.");
    }
    return parsedConfig;
  }
  resetState() {
    this.runOutsideZone(() => {
      for (const [eventName, handler] of this.delegatedHandlers.entries()) {
        document.removeEventListener(eventName, handler, true);
      }
      this.delegatedHandlers.clear();
      if (!isNil(this.beforeUnloadHandler)) {
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
    const validatedEvents = this.buildValidatedEvents(eventConfigDefinition);
    if (isNil(validatedEvents)) {
      return;
    }
    this.applyValidatedEvents(validatedEvents);
  }
  /** Version-filters, validates and translates the configuration without touching any state. Returns undefined if there is nothing usable. */
  buildValidatedEvents(eventConfigDefinition) {
    if (isEmpty(eventConfigDefinition?.configs)) {
      console.warn("No analytics configuration found");
      return void 0;
    }
    const filteredEventConfigs = filter(
      eventConfigDefinition.configs,
      (config) => this.versionFilterPredicate(config.minVersion, config.maxVersion)
    );
    this.validateEventConfigDefinition(filteredEventConfigs);
    const validatedEvents = this.applyTextContentTranslations(filteredEventConfigs.flatMap((config) => config.events));
    if (isEmpty(validatedEvents)) {
      console.warn("No analytics events found for this application version");
      return void 0;
    }
    return validatedEvents;
  }
  applyValidatedEvents(validatedEvents) {
    this.filteredEvents = validatedEvents;
    this.sequences = filter(this.filteredEvents, (dynamicEvent) => this.isSequence(dynamicEvent));
    this.buildReverseLookupMaps();
    this.precomputeListenerConfiguration();
    this.installDelegatedListeners();
    this.installBeforeUnloadListener();
    this.isInitialized = true;
  }
  applyTextContentTranslations(events) {
    if (isNil(this.translateTextContentFn)) {
      return events;
    }
    return events.map((event) => {
      if (this.isDynamicEventWithSelector(event)) {
        const selectorEvent = event;
        const hasTextContents = !isNil(selectorEvent.textContents) && !isEmpty(selectorEvent.textContents);
        const hasStatusTextContents = !isNil(selectorEvent.guardSelectorTextContents) && !isEmpty(selectorEvent.guardSelectorTextContents);
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
    each(this.filteredEvents, (dynamicEvent) => {
      if (this.isDynamicEventWithSelector(dynamicEvent)) {
        const selectorEvent = dynamicEvent;
        if (!isNil(selectorEvent.guardSelector) && !isEmpty(selectorEvent.guardSelector)) {
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
    each(this.sequences, (sequence) => {
      each(sequence.steps, (stepId) => {
        const existing = this.sequencesByStepEventId.get(stepId) ?? [];
        existing.push(sequence);
        this.sequencesByStepEventId.set(stepId, existing);
      });
      each(sequence.cancelledBy, (cancelId) => {
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
    if (isEmpty(this.beforeUnloadConfigs)) {
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
    if (isEmpty(delegatedConfigsForAction)) {
      return;
    }
    const targetElement = event.target;
    if (isNil(targetElement)) {
      return;
    }
    for (const delegatedConfig of delegatedConfigsForAction) {
      const matchingElement = this.closestMatching(targetElement, delegatedConfig.selector);
      if (isNil(matchingElement)) {
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
    if (isNil(guardSelector)) {
      return true;
    }
    const matchingStatusElements = document.querySelectorAll(guardSelector);
    if (isNil(matchingStatusElements) || matchingStatusElements.length === 0) {
      return false;
    }
    if (!isNil(dynamicEvent.guardSelectorTextContents) && !isEmpty(dynamicEvent.guardSelectorTextContents)) {
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
    if (isNil(dynamicEvent.textContents) || isEmpty(dynamicEvent.textContents)) {
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
      if (!isNil(element) && this.isDynamicEventWithSelector(dynamicEvent)) {
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
    if (isNil(dynamicEvent.guardSelector)) {
      return some(elementsMatchingSelector, (matchingElement) => matchingElement === element);
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
    if (isNil(event)) {
      return true;
    }
    if (!this.isKeyboardEventType(dynamicEvent)) {
      return true;
    }
    const keyboardDynamicEvent = dynamicEvent;
    const pressedKey = event?.key;
    if (!isNil(keyboardDynamicEvent.keys) && !isEmpty(keyboardDynamicEvent.keys)) {
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
    if (isEmpty(this.beforeUnloadConfigs)) {
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
    if (!isEmpty(dynamicEvent.additionalDataSelectors)) {
      additionalData = dynamicEvent.additionalDataSelectors.map((selector) => {
        const elementWithData = document.querySelector(selector);
        if (!isNil(elementWithData)) {
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
      if (!isNil(event.selector)) {
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
    each(sequencesContainingThisEvent, (sequence) => {
      if (includes(this.sequenceTracker[sequence.id], dynamicEvent.id)) {
        progress.push(`Sequence ${sequence.id} = ${this.sequenceTracker[sequence.id].length}/${sequence.steps.length}`);
      }
    });
    return progress.join(", ");
  }
  onStepEvent(dynamicEvent, event) {
    const sequencesCancelledByThisEvent = this.sequencesByCancelEventId.get(dynamicEvent.id) ?? [];
    if (!isEmpty(sequencesCancelledByThisEvent)) {
      const resetSequences = [];
      each(sequencesCancelledByThisEvent, (sequence) => {
        const tracker = this.sequenceTracker[sequence.id] = this.sequenceTracker[sequence.id] ?? [];
        if (!isEmpty(tracker) && includes(sequence.cancelledBy, dynamicEvent.id) && !this.doesEventTargetTriggerStepEvent(sequence, event)) {
          resetSequences.push(sequence);
          this.resetSequence(sequence);
          this.blockedSequenceIds.add(sequence.id);
          setTimeout(() => {
            this.blockedSequenceIds.delete(sequence.id);
          }, 10);
        }
      });
      if (!isEmpty(resetSequences)) {
        this.log(`Sequence reset by event ${dynamicEvent.id}: ${resetSequences.map((sequence) => sequence.id).join(",")}`);
      }
    }
    const sequencesContainingThisEvent = (this.sequencesByStepEventId.get(dynamicEvent.id) ?? []).filter((sequence) => !this.blockedSequenceIds.has(sequence.id));
    each(sequencesContainingThisEvent, (sequence) => {
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
        const nextEventInSequence = find(this.filteredEvents, (dynamicEvent2) => dynamicEvent2.id === nextEventIdInSequence);
        if (isNil(nextEventInSequence)) {
          this.trackError(`Next event in sequence not found. Incorrect Id specified? Next event id ${nextEventIdInSequence}. Sequence ${sequence.id}`);
          this.resetSequence(sequence);
          return;
        }
        if (this.isTimedEvent(nextEventInSequence)) {
          this.startTimedEventTimerForSequence(nextEventInSequence, sequence);
        }
        if (tracker.length === 1 && !isNil(sequence.timeout)) {
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
    if (!isNil(tracker[dynamicEvent.id])) {
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
    if (!isNil(tracker)) {
      each(tracker, (timeoutId) => clearTimeout(timeoutId));
    }
    delete this.timedEventForSequenceTracker[sequence.id];
  }
  startSequenceTimeout(sequence) {
    const tracker = this.timedEventForSequenceTracker[sequence.id] = this.timedEventForSequenceTracker[sequence.id] ?? {};
    tracker[sequence.id] = setTimeout(() => {
      if (!isEmpty(this.sequenceTracker[sequence.id])) {
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
    if (isNil(event)) {
      return false;
    }
    const tracker = this.sequenceTracker[sequence.id];
    if (isEmpty(tracker)) {
      return false;
    }
    const otherStepEventId = sequence.steps[tracker.length - 1];
    const stepEvent = find(this.filteredEvents, (dynamicEvent) => dynamicEvent.id === otherStepEventId);
    if (isNil(stepEvent) || !this.isDynamicEventWithSelector(stepEvent)) {
      return false;
    }
    const elementsMatchingSelector = document.querySelectorAll(stepEvent.guardSelector ?? stepEvent.selector);
    const target = event.target;
    return some(elementsMatchingSelector, (element) => element === target || element.contains(target));
  }
  validateEventConfigDefinition(filteredEventConfigs) {
    const uniqueEventIds = /* @__PURE__ */ new Set();
    const uniqueSequenceStepEventIds = /* @__PURE__ */ new Set();
    const uniqueCancelEventIds = /* @__PURE__ */ new Set();
    each(filteredEventConfigs, (config) => {
      each(config.events, (event) => {
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
        if (this.isTimedEvent(event) && (event.timeout <= 0 || Number.isNaN(event.timeout))) {
          throw new Error("Timeout event must be a number greater than zero");
        }
        if (!isNil(event.additionalData)) {
          throw new Error("Additional data must not be provided in the configuration. Use `additionalDataSelectors` to allow the service to find additional data in the DOM at event-time");
        }
        if (!isNil(event.additionalDataSelectors) && some(event.additionalDataSelectors, (selector) => isEmpty(selector))) {
          throw new Error("Additional data selectors cannot be an empty string");
        }
        if (this.isDynamicEventWithSelector(event) && !isNil(event.selector) && isEmpty(event.selector)) {
          throw new Error("Selector cannot be an empty string");
        }
        if (this.isDynamicEventWithSelector(event) && event.matchExactTextContents === true && (isNil(event.textContents) || isEmpty(event.textContents))) {
          throw new Error("matchExactTextContents can only be true when textContents is a non-empty string");
        }
        if (this.isDynamicEventWithSelector(event) && !isNil(event.guardSelectorTextContents) && !isEmpty(event.guardSelectorTextContents) && (isNil(event.guardSelector) || isEmpty(event.guardSelector))) {
          throw new Error("guardSelectorTextContents requires a non-empty guardSelector");
        }
        if (this.isDynamicEventWithSelector(event) && event.matchExactGuardSelectorTextContents === true && (isNil(event.guardSelectorTextContents) || isEmpty(event.guardSelectorTextContents))) {
          throw new Error("matchExactGuardSelectorTextContents can only be true when guardSelectorTextContents is a non-empty string");
        }
        if (!isNil(event.keys)) {
          if (!this.isKeyboardEventType(event)) {
            throw new Error("keys can only be specified for keyboard event types");
          }
          if (isEmpty(event.keys)) {
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
      if (!isNil(tracker)) {
        each(tracker, (timeoutId) => clearTimeout(timeoutId));
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