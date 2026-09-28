# Form.io parity matrix

Status is per applicable setting. `FULL` means the inspector edits it, the document stores it, and the native renderer or export uses it. `PARTIAL` means it is editable and lossless, with the runtime limit in the reason. `INTENTIONALLY_UNSUPPORTED` means the value is kept and is not executed.

| Component | Property | Tab | Status | Reason |
|---|---|---|---|---|
| address | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `enableManualMode` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `switchToManualModeLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `disableClearIcon` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `addAnother` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| address | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| address | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| address | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| address | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| address | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| address | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| address | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| address | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `provider` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `subscriptionKey` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `url` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `queryProperty` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `responseProperty` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `displayValueProperty` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `params` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `apiKey` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `autocompleteOptions` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `manualModeViewString` | provider | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| address | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| address | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| address | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| address | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| address | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| address | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| address | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| address | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| address | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| address | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| address | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| address | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| button | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `action` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `oauthProvider` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `state` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `saveOnEnter` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `showValidations` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `event` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `url` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `custom` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `headers` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `theme` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `size` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `block` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `leftIcon` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `rightIcon` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `shortcut` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `disableOnInvalid` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| button | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| button | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| button | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| button | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| button | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| button | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| button | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| button | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| button | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| checkbox | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `shortcut` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `inputType` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `name` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `value` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| checkbox | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| checkbox | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| checkbox | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| checkbox | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| checkbox | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| checkbox | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| checkbox | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| checkbox | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| checkbox | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| checkbox | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| checkbox | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| checkbox | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| checkbox | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| checkbox | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| checkbox | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| checkbox | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| checkbox | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| checkbox | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| checkbox | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| columns | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `columns` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `autoAdjust` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| columns | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| columns | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| columns | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| columns | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| columns | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| columns | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| columns | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| columns | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| columns | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| container | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| container | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| container | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| container | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| container | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| container | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| container | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| container | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| container | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| container | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| container | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| container | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| container | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| container | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| container | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| container | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| container | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| container | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| container | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| container | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| container | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| content | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| content | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| content | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `refreshOnChange` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| content | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| content | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| content | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| content | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| content | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| content | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| content | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| content | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| content | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| content | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| content | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| content | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| content | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| currency | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `mask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `currency` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `inputFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| currency | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| currency | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| currency | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| currency | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| currency | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| currency | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| currency | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| currency | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| currency | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| currency | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| currency | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| currency | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| currency | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| currency | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| currency | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| currency | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| currency | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| currency | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| currency | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| currency | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datagrid | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `disableAddingRemovingRows` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `conditionalAddButton` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `reorder` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `addAnother` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `addAnotherPosition` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `layoutFixed` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `enableRowGroups` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `rowGroups` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `groupToggle` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `initEmpty` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| datagrid | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| datagrid | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| datagrid | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datagrid | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datagrid | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| datagrid | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| datagrid | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| datagrid | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `validate.minLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `validate.maxLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datagrid | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datagrid | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datagrid | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datagrid | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| datagrid | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datagrid | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datagrid | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datagrid | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datagrid | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datagrid | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datagrid | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datamap | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `keyLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `disableAddingRemovingRows` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `keyBeforeValue` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `addAnother` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| datamap | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| datamap | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| datamap | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datamap | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datamap | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| datamap | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| datamap | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| datamap | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| datamap | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datamap | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datamap | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datamap | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datamap | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| datamap | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datamap | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datamap | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datamap | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datamap | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datamap | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datamap | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datetime | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `displayInTimezone` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `timezone` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `useLocaleSettings` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `allowInput` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `format` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `shortcutButtons` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `enableDate` | date | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `datePicker.disable` | date | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `datePicker.disableFunction` | date | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `datePicker.disableWeekends` | date | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `datePicker.disableWeekdays` | date | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `enableTime` | time | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `timePicker.hourStep` | time | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `timePicker.minuteStep` | time | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `timePicker.showMeridian` | time | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `defaultDate` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `customOptions` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| datetime | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| datetime | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| datetime | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datetime | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datetime | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| datetime | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| datetime | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| datetime | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `enableMinDateInput` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `datePicker.minDate` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `enableMaxDateInput` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `datePicker.maxDate` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| datetime | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datetime | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datetime | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| datetime | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| datetime | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| datetime | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| datetime | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datetime | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datetime | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datetime | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datetime | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| datetime | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| day | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `hideInputLabels` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `inputsLabelPosition` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `useLocaleSettings` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.day.type` | day | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.day.placeholder` | day | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.day.hide` | day | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `dayFirst` | day | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.month.type` | month | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.month.placeholder` | month | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.month.hide` | month | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.year.type` | year | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.year.minYear` | year | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.year.maxYear` | year | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.year.placeholder` | year | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.year.hide` | year | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| day | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| day | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| day | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| day | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| day | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| day | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| day | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| day | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.day.required` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.month.required` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `fields.year.required` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `maxDate` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `minDate` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| day | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| day | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| day | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| day | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| day | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| day | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| day | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| day | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| day | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| day | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| day | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| day | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| editgrid | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `openWhenEmpty` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `disableAddingRemovingRows` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `displayAsTable` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `conditionalAddButton` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `templates.header` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `templates.tableHeader` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `templates.row` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `templates.tableRow` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `templates.footer` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `rowClass` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `addAnother` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `modal` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `saveRow` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `removeRow` | templates | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `inlineEdit` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| editgrid | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| editgrid | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| editgrid | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| editgrid | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| editgrid | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| editgrid | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| editgrid | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| editgrid | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `rowDrafts` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `validate.minLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `validate.maxLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| editgrid | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| editgrid | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| editgrid | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| editgrid | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| editgrid | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| editgrid | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| editgrid | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| editgrid | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| editgrid | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| editgrid | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| editgrid | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| email | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `mask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `spellcheck` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `inputFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| email | `case` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| email | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| email | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| email | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| email | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| email | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| email | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| email | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| email | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `kickbox.enabled` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `validate.minLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `validate.maxLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `validate.pattern` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| email | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| email | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| email | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| email | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| email | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| email | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| email | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| email | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| email | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| email | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| email | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| fieldset | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `legend` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| fieldset | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| fieldset | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| fieldset | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| fieldset | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| fieldset | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| fieldset | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| fieldset | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| fieldset | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| fieldset | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| fieldset | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| fieldset | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| fieldset | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| fieldset | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| fieldset | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| fieldset | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| file | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `autoSync` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `storage` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `useMultipartUpload` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `multipart` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `url` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `options.indexeddb` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `options.indexeddbTable` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `options` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `fileKey` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `dir` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `fileNameTemplate` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `image` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `uploadOnly` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `privateDownload` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `imageSize` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `webcam` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `webcamSize` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `capture` | file | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `fileTypes` | file | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `filePattern` | file | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `fileMinSize` | file | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `fileMaxSize` | file | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| file | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| file | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| file | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| file | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| file | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| file | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| file | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| file | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| file | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| file | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| file | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| file | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| file | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| file | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| file | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| file | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| file | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| file | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| file | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| form | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `form` | form | PARTIAL | Nested Form schema is stored. Form.io resource loading is not available; use a container for nested fields. |
| form | `lazyLoad` | form | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| form | `revision` | form | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `useOriginalRevision` | form | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `reference` | form | PARTIAL | Nested Form schema is stored. Form.io resource loading is not available; use a container for nested fields. |
| form | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| form | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| form | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| form | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| form | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| form | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| form | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| form | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| form | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| form | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| form | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| form | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| form | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| form | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| hidden | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| hidden | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| hidden | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| hidden | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| hidden | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| hidden | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| hidden | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| hidden | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| hidden | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| hidden | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| hidden | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| hidden | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| hidden | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| hidden | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| hidden | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| hidden | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| hidden | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| hidden | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| hidden | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| hidden | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| hidden | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| hidden | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| hidden | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| hidden | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| hidden | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| hidden | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| hidden | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| hidden | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| htmlelement | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `tag` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `className` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `attrs` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `content` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `refreshOnChange` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| htmlelement | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| htmlelement | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| htmlelement | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| htmlelement | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| htmlelement | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| htmlelement | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| htmlelement | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| htmlelement | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| htmlelement | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| number | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `mask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `delimiter` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `decimalLimit` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `requireDecimal` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `inputFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| number | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| number | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| number | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| number | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| number | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| number | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| number | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| number | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `validate.min` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `validate.max` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| number | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| number | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| number | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| number | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| number | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| number | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| number | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| number | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| number | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| number | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| number | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| panel | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `title` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `theme` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `breadcrumbClickable` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `allowPrevious` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `buttonSettings` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `navigateOnEnter` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `saveOnEnter` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `scrollToTop` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `collapsible` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `collapsed` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| panel | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `nextPage` | conditional | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `nextPage` | conditional | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| panel | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| panel | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| panel | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| panel | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| panel | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| panel | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| panel | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| panel | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| password | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `showWordCount` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `showCharCount` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `spellcheck` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `passwordInfo` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `case` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| password | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| password | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `validate.minLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `validate.maxLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `validate.pattern` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| password | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| password | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| password | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| password | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| password | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| password | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| password | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| password | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| password | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| password | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| password | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| phoneNumber | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `inputMask` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `allowMultipleMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `mask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `spellcheck` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `inputFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| phoneNumber | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| phoneNumber | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| phoneNumber | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| phoneNumber | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| phoneNumber | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| phoneNumber | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| phoneNumber | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| phoneNumber | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| phoneNumber | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| phoneNumber | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| phoneNumber | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| phoneNumber | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| phoneNumber | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| phoneNumber | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| phoneNumber | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| phoneNumber | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| phoneNumber | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| phoneNumber | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| phoneNumber | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| phoneNumber | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| radio | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `optionsLabelPosition` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `inline` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `dataSrc` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `data.url` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `values` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `data.headers` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| radio | `dataType` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `valueProperty` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `template` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `authenticate` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| radio | `ignoreCache` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| radio | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| radio | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| radio | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| radio | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| radio | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| radio | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| radio | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| radio | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| radio | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `validate.onlyAvailableItems` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| radio | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| radio | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| radio | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| radio | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| radio | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| radio | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| radio | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| radio | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| radio | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| radio | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| radio | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| recaptcha | `recaptchaInfo` | display | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `labelWidth` | display | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `labelMargin` | display | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `eventType` | display | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `buttonKey` | display | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `modalEdit` | display | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `key` | api | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `tags` | api | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `properties` | api | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `attributes` | layout | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `overlay.style` | layout | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `overlay.page` | layout | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `overlay.left` | layout | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `overlay.top` | layout | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `overlay.width` | layout | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| recaptcha | `overlay.height` | layout | INTENTIONALLY_UNSUPPORTED | reCAPTCHA is registered in OSS but executing it requires a third-party challenge and a server secret. The schema is kept and is not run. |
| select | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `uniqueOptions` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `dataSrc` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `data.url` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `indexeddb.database` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `data.json` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `data.values` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `data.resource` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `data.headers` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `lazyLoad` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `valueProperty` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `selectValues` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `dataType` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `idPath` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `valueProperty` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `selectFields` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `data.custom` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `disableLimit` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `indexeddb.table` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `searchField` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `searchDebounce` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `minSearch` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `template` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `indexeddb.filter` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `filter` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `sort` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `limit` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `refreshOn` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `refreshOnBlur` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `clearOnRefresh` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `searchEnabled` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `noRefreshOnScroll` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `selectThreshold` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `addResource` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `addResourceLabel` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `reference` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `authenticate` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `readOnlyValue` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `customOptions` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `ignoreCache` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| select | `useExactSearch` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| select | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| select | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| select | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| select | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| select | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| select | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| select | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| select | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `selectData` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `validate.select` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `validate.onlyAvailableItems` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| select | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| select | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| select | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| select | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| select | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| select | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| select | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| select | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| select | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| select | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| select | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| select | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| selectboxes | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `optionsLabelPosition` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `inline` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `dataSrc` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `data.url` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `values` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `data.headers` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| selectboxes | `valueProperty` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `template` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `authenticate` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| selectboxes | `ignoreCache` | data | PARTIAL | The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are. |
| selectboxes | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| selectboxes | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| selectboxes | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| selectboxes | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| selectboxes | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| selectboxes | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| selectboxes | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| selectboxes | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| selectboxes | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `validate.onlyAvailableItems` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `validate.minSelectedCount` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `validate.maxSelectedCount` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `minSelectedCountMessage` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `maxSelectedCountMessage` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| selectboxes | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| selectboxes | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| selectboxes | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| selectboxes | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| selectboxes | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| selectboxes | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| selectboxes | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| selectboxes | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| selectboxes | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| selectboxes | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| selectboxes | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| signature | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `footer` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `width` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `height` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `keepOverlayRatio` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `backgroundColor` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `penColor` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| signature | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| signature | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| signature | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| signature | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| signature | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| signature | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| signature | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| signature | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| signature | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| signature | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| signature | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| signature | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| signature | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| signature | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| signature | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| signature | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| signature | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| signature | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| survey | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `questions` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `values` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| survey | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| survey | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| survey | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| survey | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| survey | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| survey | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| survey | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| survey | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| survey | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| survey | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| survey | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| survey | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| survey | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| survey | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| survey | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| survey | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| survey | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| survey | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| survey | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| survey | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| table | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `numRows` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `numCols` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `cloneRows` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `cellAlignment` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `striped` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `bordered` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `hover` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `condensed` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| table | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| table | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| table | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| table | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| table | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| table | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| table | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| table | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| table | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tabs | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `components` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `verticalLayout` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tabs | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| tabs | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| tabs | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tabs | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tabs | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tabs | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tabs | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tabs | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tabs | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tags | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `delimeter` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `maxTags` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `storeas` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| tags | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| tags | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| tags | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| tags | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| tags | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| tags | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| tags | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| tags | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| tags | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| tags | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| tags | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| tags | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| tags | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| tags | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| tags | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tags | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tags | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tags | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tags | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| tags | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textarea | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `rows` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `editor` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `autoExpand` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `isUploadEnabled` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `uploadStorage` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `uploadUrl` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `uploadOptions` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `uploadDir` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `fileKey` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `as` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `wysiwyg` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `showWordCount` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `showCharCount` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `spellcheck` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `inputFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| textarea | `case` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| textarea | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| textarea | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textarea | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textarea | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| textarea | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| textarea | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| textarea | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| textarea | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `validate.minLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `validate.maxLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `validate.minWords` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `validate.maxWords` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `validate.pattern` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textarea | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textarea | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textarea | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textarea | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| textarea | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textarea | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textarea | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textarea | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textarea | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textarea | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textarea | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textfield | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `inputMask` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `allowMultipleMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `showWordCount` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `showCharCount` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `mask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `spellcheck` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `inputFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| textfield | `case` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| textfield | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| textfield | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textfield | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textfield | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| textfield | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| textfield | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| textfield | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| textfield | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `validate.minLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `validate.maxLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `validate.minWords` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `validate.maxWords` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `validate.pattern` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textfield | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textfield | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| textfield | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| textfield | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| textfield | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| textfield | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textfield | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textfield | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textfield | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textfield | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| textfield | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| time | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `inputType` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `format` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `dataFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| time | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| time | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| time | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| time | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| time | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| time | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| time | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| time | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| time | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| time | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| time | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| time | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| time | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| time | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| time | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| time | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| time | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| time | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| time | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| time | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| url | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `labelPosition` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `placeholder` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `description` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `tooltip` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `prefix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `suffix` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `widget.type` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `widget` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `displayMask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `applyMaskOn` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `inputMaskPlaceholderChar` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `inputMasks` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `tabindex` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `autocomplete` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `hideLabel` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `mask` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `autofocus` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `spellcheck` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `tableView` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `multiple` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `defaultValue` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `persistent` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `inputFormat` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `protected` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `dbIndex` | data | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| url | `truncateMultipleSpaces` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `encrypted` | data | PARTIAL | The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher. |
| url | `redrawOn` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| url | `clearOnHide` | data | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| url | `customDefaultValue` | data | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| url | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| url | `calculateValue` | data | PARTIAL | Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed. |
| url | `calculateServer` | data | PARTIAL | Stored. Calculations run in the browser on change; there is no separate server calculate pass. |
| url | `allowCalculateOverride` | data | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `validateOn` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `validate.required` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `unique` | validation | PARTIAL | Stored on the component. A database unique index is not created automatically for the field. |
| url | `validateWhenHidden` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `validate.minLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `validate.maxLength` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `validate.pattern` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `errorLabel` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `validate.customMessage` | validation | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `validate.custom` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| url | `validate.customPrivate` | validation | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| url | `validate.json` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `errors` | validation | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| url | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| url | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| url | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| url | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| url | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| url | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| url | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| url | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| url | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| well | `label` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `labelWidth` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| well | `labelMargin` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| well | `customClass` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `hidden` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `dataGridLabel` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| well | `disabled` | display | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `modalEdit` | display | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| well | `key` | api | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `tags` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| well | `properties` | api | PARTIAL | Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property. |
| well | `conditional.show` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `conditional.when` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `conditional.eq` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `customConditional` | conditional | INTENTIONALLY_UNSUPPORTED | Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it. |
| well | `conditional.json` | conditional | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `logic` | logic | PARTIAL | Logic rules are stored and edited. Custom JavaScript actions are not executed. |
| well | `attributes` | layout | FULL | Shown in the inspector, stored on the component document, and applied by the native renderer or export. |
| well | `overlay.style` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| well | `overlay.page` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| well | `overlay.left` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| well | `overlay.top` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| well | `overlay.width` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
| well | `overlay.height` | layout | PARTIAL | Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers. |
