Dynamic Analytics Service
-----------------------------------

This service allows developers to define and load event configurations that can dynamically track user actions and control complex event sequences, providing flexible analytics tracking. Configurations are loaded at runtime, enabling custom event handling across different application versions.

### Simple setup instructions
1. **Install the package**: 
   ```bash
   npm install https://github.com/AquaticInformatics/NodePackages#dynamic-analytics
   ```

### Configuration Structure

Each configuration includes versioning parameters and events:

```
export interface IEventConfigDefinition {
  configs: IEventConfig[];          // Collection of event configurations
}

export interface IEventConfig {
  minVersion: string | undefined;   // Version floor for applying this config
  maxVersion: string | undefined;   // Version ceiling for applying this config
  events: DynamicEvent[];           // List of events in this configuration
}
```

1. **Versioning**

* **minVersion** and **maxVersion**: Consumers define these optional parameters in any format (e.g., `1.0`, `1.0.0-beta`) as strings or numbers. A version-checking predicate function, `versionFilterPredicate`, will verify these values against the current application version and return a boolean indicating compatibility.

2. **Event Types and Actions**

* Events are classified into `Simple`, `Sequence`, and `StepEvent` types, which determine trackability and usage. Below is a reference table outlining each type's purpose and structure:

| Event Type    | Description                                                                                              | Trackable | Typical Use                                                 | Key Properties                                                                                             |
|---------------|----------------------------------------------------------------------------------------------------------|-----------|-------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| **Simple**    | Standalone event that triggers an analytics event when fired. Can be included in a Sequence.             | Yes       | Single actions (e.g., button clicks)                        | `selector` (cannot be used with Timed events), `eventAction`, `message`, `timeout` (only for Timed events) |
| **Sequence**  | Complex event containing a sequence of actions; triggers an optional final analytics event on completion | Optional  | Step-based workflows                                        | `steps`, `cancelledBy`, `trackable`, `message `                                                            |
| **StepEvent** | Step in a sequence; used only within sequences and not tracked independently                             | No        | Intermediate steps in a sequence (e.g., filling out a form) | `selector` (cannot be used with Timed events), `eventAction`, `timeout` (only for Timed events)            |

3. **Event Actions**

* Actions are split across `MouseEventAction`, `KeyboardEventAction`, and `MiscellaneousEventAction` types, each supporting various user interactions (e.g., clicks, key presses). Simple Events support analytics tracking, whereas Step Events are solely for sequencing within workflows.
* **Timed Events** and **BeforeUnload Events** within `MiscellaneousEventAction` help manage sequences, either progressing or canceling sequences under specific conditions.

4. **Selectors and Event Validity**

* **selector**: CSS or DOM selector that binds the event to a UI element.
* **additionalDataSelectors** (optional): Array of CSS or DOM selectors that read multiple pieces of data from the DOM when the event fires and sends it (onEvent -> event.additionalData) along with the event.
* **statusSelector** (optional): Conditional selector that verifies the event's validity when it fires (e.g., “Fire event only if element Z is visible and enabled”).

  **Suggested Best Practices**:

* Use `statusSelector` when an event should only fire in specific UI states.

5. **Sequences and sequence cancellation**

* **Sequences** provide structured workflows by chaining events (e.g., "Open popup," "Fill input," "Click Save").
* **Cancellation events** terminate sequences without analytics tracking, used for actions that interrupt workflows (e.g., closing a popup).
* **Timeout** terminate sequences if it hasn't been completed within a set number of milliseconds.

#### Example: Trackable Sequence with Cancel Events

In the example below, Simple events function both as standalone events and as part of the Sequence (#4), becoming step events once their preceding steps in the steps list have occurred. The Sequence itself triggers an analytics event upon completion, as indicated by the `trackable: true` property

```
const eventConfig: IEventConfig = {
  minVersion: '1.0',
  maxVersion: '2.0',
  events: [
    { id: 1, dynamicType: DynamicType.Simple, eventAction: MouseEventAction.Click, selector: '#openPopup', message: 'User opened popup', label: 'Open Popup' }, 
    { id: 2, dynamicType: DynamicType.StepEvent, eventAction: KeyboardEventAction.KeyPress, selector: '#inputField', message: 'User typed in input field', label: 'User typed', statusSelector: '#saveButton:not([disabled])' },
    { id: 3, dynamicType: DynamicType.Simple, eventAction: MouseEventAction.Click, selector: '#saveButton', message: 'User clicked save', label: 'User saved', additionalDataSelector: '#inputField0' },
    { id: 4, dynamicType: DynamicType.Sequence, steps: [1, 2, 3], cancelledBy: [5], timeout: 300000, trackable: true, message: 'User completed form sequence' },
    { id: 5, dynamicType: DynamicType.StepEvent, eventAction: MouseEventAction.Click, selector: '#closePopup', message: 'User canceled sequence' }
  ]
};
```

### Configuration Validation Requirements

The private `validateEventConfigDefinition` function enforces several key rules:

* **Event IDs** must be unique.
* **Sequences** require at least two `steps` and cannot self-reference.
* **Cancel Events** and **Step Events** must correspond to existing event IDs.
* **Timed Events** need a positive `timeout` value (in miliseconds).

### Getting Started

1. Define configurations per application version, setting an optional `minVersion` and `maxVersion`.
2. Assign unique IDs to events, and structure sequences with appropriate `steps` and `cancelledBy`.
3. Use `Simple Events` for direct tracking, and `Sequences` with `Step Events` for step-based workflows.
4. Load configurations into the service using `initializeWithConfig()`, and set `loggingEnabled` to `true` for debugging purposes.
5. Initialization will automatically verify validity using `validateEventConfigDefinition` to prevent common setup errors.
6. Strict typing will help you to define your configuration.
7. Once you're satisfied and certain that the configuration will achieve what you need, upload the config as a json file and switch over to the `initialize()` function to load the final config from a URL.
8. Remember to set `logginEnabled` to `false` when you're done.
