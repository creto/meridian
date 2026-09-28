# Text Field

Type `textfield`. Group `basic`. 79 effective settings.

## Default schema

```json
{
  "input": true,
  "key": "textField",
  "placeholder": "",
  "prefix": "",
  "customClass": "",
  "suffix": "",
  "multiple": false,
  "defaultValue": null,
  "protected": false,
  "unique": false,
  "persistent": true,
  "hidden": false,
  "clearOnHide": true,
  "refreshOn": "",
  "redrawOn": "",
  "tableView": true,
  "modalEdit": false,
  "label": "Text Field",
  "dataGridLabel": false,
  "labelPosition": "top",
  "description": "",
  "errorLabel": "",
  "tooltip": "",
  "hideLabel": false,
  "tabindex": "",
  "disabled": false,
  "autofocus": false,
  "dbIndex": false,
  "customDefaultValue": "",
  "calculateValue": "",
  "calculateServer": false,
  "widget": {
    "type": "input"
  },
  "attributes": {},
  "validateOn": "change",
  "validate": {
    "required": false,
    "custom": "",
    "customPrivate": false,
    "strictDateValidation": false,
    "multiple": false,
    "unique": false,
    "minLength": "",
    "maxLength": "",
    "pattern": ""
  },
  "conditional": {
    "show": null,
    "when": null,
    "eq": ""
  },
  "overlay": {
    "style": "",
    "left": "",
    "top": "",
    "width": "",
    "height": ""
  },
  "allowCalculateOverride": false,
  "encrypted": false,
  "showCharCount": false,
  "showWordCount": false,
  "properties": {},
  "allowMultipleMasks": false,
  "addons": [],
  "type": "textfield",
  "mask": false,
  "inputType": "text",
  "inputFormat": "plain",
  "inputMask": "",
  "displayMask": "",
  "spellcheck": true,
  "truncateMultipleSpaces": false
}
```

## Settings

### Display

- `label` (textfield) — FULL. The label for this field that will appear next to it.
- `labelPosition` (select) — FULL. Position for the label for this field.
- `labelWidth` (number) — PARTIAL. The width of label on line in percentages.
- `labelMargin` (number) — PARTIAL. The width of label margin on line in percentages.
- `placeholder` (textfield) — FULL. The placeholder text that will appear when this field is empty.
- `description` (textarea) — FULL. The description is text that will appear below the input field.
- `tooltip` (textarea) — FULL. Adds a tooltip to the side of this field.
- `prefix` (textfield) — FULL. Prefix
- `suffix` (textfield) — FULL. Suffix
- `widget.type` (select) — PARTIAL. The widget is the display UI used to input the value of the field.
- `widget` (textarea) — PARTIAL. Widget Settings
- `inputMask` (textfield) — FULL. An input mask helps the user with input by ensuring a predefined format.<br><br>9: numeric<br>a: alphabetical<br>*: alphanumeric<br><br>Example telephone mask: (999) 999-9999<br><br>See the <a target='_blank' href='https://github.com/RobinHerbots/jquery.inputmask'>jquery.inputmask documentation</a> for more information.</a>
- `displayMask` (textfield) — PARTIAL. A display mask helps to display the input in a readable way, this won't affect the  value which will be saved (to affect both view and saved value, delete Display Mask and use Input Mask).<br><br>9: numeric<br>a: alphabetical<br>*: alphanumeric<br><br>Example telephone mask: (999) 999-9999<br><br>See the <a target='_blank' href='https://github.com/RobinHerbots/jquery.inputmask'>jquery.inputmask documentation</a> for more information.</a>
- `applyMaskOn` (select) — PARTIAL. Select the type of applying mask.
- `inputMaskPlaceholderChar` (textfield) — PARTIAL. You can specify a char which will be used as a placeholder in the field. <br>E.g., ˍ<br>Make note that placeholder char will be replaced by a space if it is used inside the mask
- `allowMultipleMasks` (checkbox) — PARTIAL. Allow Multiple Masks
- `inputMasks` (datagrid) — PARTIAL. Input Masks
- `customClass` (textfield) — FULL. Custom CSS class to add to this component.
- `tabindex` (textfield) — FULL. Sets the tabindex attribute of this component to override the tab order of the form. See the <a href='https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex'>MDN documentation</a> on tabindex for more information.
- `autocomplete` (textfield) — FULL. Indicates whether input elements can by default have their values automatically completed by the browser. See the <a href='https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete'>MDN documentation</a> on autocomplete for more information.
- `hidden` (checkbox) — FULL. A hidden field is still a part of the form, but is hidden from view.
- `hideLabel` (checkbox) — FULL. Hide the label (title, if no label) of this component. This allows you to show the label in the form builder, but not when it is rendered.
- `showWordCount` (checkbox) — FULL. Show a live count of the number of words.
- `showCharCount` (checkbox) — FULL. Show a live count of the number of characters.
- `mask` (checkbox) — PARTIAL. Hide the input in the browser. This does not encrypt on the server. Do not use for passwords.
- `autofocus` (checkbox) — FULL. Make this field the initially focused element on this form.
- `spellcheck` (checkbox) — FULL. Allow Spellcheck
- `dataGridLabel` (checkbox) — PARTIAL. Show the label inside each row when in a Datagrid.
- `disabled` (checkbox) — FULL. Disable the form input.
- `tableView` (checkbox) — FULL. Shows this value within the table view of the submissions.
- `modalEdit` (checkbox) — PARTIAL. Opens up a modal to edit the value of this component.

### Data

- `multiple` (checkbox) — FULL. Allows multiple values to be entered for this field.
- `defaultValue` (textfield) — FULL. The Default Value will be the value for this field, before user interaction. Having a default value will override the placeholder text.
- `persistent` (radio) — FULL. A persistent field will be stored in database when the form is submitted.
- `inputFormat` (select) — PARTIAL. Force the output of this field to be sanitized in a specific format.
- `protected` (checkbox) — FULL. A protected field will not be returned when queried via API.
- `dbIndex` (checkbox) — PARTIAL. Set this field as an index within the database. Increases performance for submission queries.
- `case` (radio) — FULL. When data is entered, you can change the case of the value.
- `truncateMultipleSpaces` (checkbox) — FULL. Truncate Multiple Spaces
- `encrypted` (checkbox) — PARTIAL. Encrypt this field on the server. This is two way encryption which is not suitable for passwords.
- `redrawOn` (select) — PARTIAL. Redraw this component if another component changes. This is useful if interpolating parts of the component like the label.
- `clearOnHide` (checkbox) — FULL. When a field is conditionally hidden, omit the value from the submission data.
- `customDefaultValue` (textarea) — INTENTIONALLY_UNSUPPORTED.
- `customDefaultValue` (textarea) — INTENTIONALLY_UNSUPPORTED.
- `calculateValue` (textarea) — PARTIAL.
- `calculateValue` (textarea) — PARTIAL.
- `calculateServer` (checkbox) — PARTIAL. Checking this will run the calculation on the server. This is useful if you wish to override the values submitted with the calculations performed on the server.
- `allowCalculateOverride` (checkbox) — PARTIAL. When checked, this will allow the user to manually override the calculated value.

### Validation

- `validateOn` (select) — PARTIAL. Determines when this component should trigger front-end validation.
- `validate.required` (checkbox) — FULL. A required field must be filled in before the form can be submitted.
- `unique` (checkbox) — PARTIAL. Makes sure the data submitted for this field is unique, and has not been submitted before.
- `validateWhenHidden` (checkbox) — PARTIAL. Validates the component when it is hidden/conditionally hidden. Vaildation errors are displayed in the error alert on the form submission. Use caution when enabling this setting, as it can cause a hidden component to be invalid with no way for the form user to correct it.
- `validate.minLength` (number) — FULL. The minimum length requirement this field must meet.
- `validate.maxLength` (number) — FULL. The maximum length requirement this field must meet.
- `validate.minWords` (number) — FULL. The minimum amount of words that can be added to this field.
- `validate.maxWords` (number) — FULL. The maximum amount of words that can be added to this field.
- `validate.pattern` (textfield) — FULL. The regular expression pattern test that the field value must pass before the form can be submitted.
- `errorLabel` (textfield) — FULL. The label for this field when an error occurs.
- `validate.customMessage` (textfield) — FULL. Error message displayed if any error occurred.
- `validate.custom` (textarea) — INTENTIONALLY_UNSUPPORTED.
- `validate.customPrivate` (checkbox) — INTENTIONALLY_UNSUPPORTED. Check this if you wish to perform the validation ONLY on the server side. This keeps your validation logic private and secret.
- `validate.json` (textarea) — PARTIAL.
- `errors` (textarea) — PARTIAL.

### API

- `key` (textfield) — FULL. The name of this field in the API endpoint.
- `tags` (tags) — PARTIAL. Tag the field for use in custom logic.
- `properties` (datamap) — PARTIAL. This allows you to configure any custom properties for this component.

### Conditional

- `conditional.show` (select) — FULL. This component should Display:
- `conditional.when` (select) — FULL. When the form component:
- `conditional.eq` (textfield) — FULL. Has the value:
- `customConditional` (textarea) — INTENTIONALLY_UNSUPPORTED.
- `conditional.json` (textarea) — FULL.

### Logic

- `logic` (editgrid) — PARTIAL. Advanced Logic

### Layout

- `attributes` (datamap) — FULL. Provide a map of HTML attributes for component's input element (attributes provided by other component settings or other attributes generated by form.io take precedence over attributes in this grid)
- `overlay.style` (textfield) — PARTIAL. Custom styles that should be applied to this component when rendered in PDF.
- `overlay.page` (textfield) — PARTIAL. The PDF page to place this component.
- `overlay.left` (textfield) — PARTIAL. The left margin within a page to place this component.
- `overlay.top` (textfield) — PARTIAL. The top margin within a page to place this component.
- `overlay.width` (textfield) — PARTIAL. The width of the component (in pixels).
- `overlay.height` (textfield) — PARTIAL. The height of the component (in pixels).

## Runtime

Meridian renders this component with its native field control. Settings marked FULL change that control or validation. Other applicable settings are kept on `component.formio` and survive import, reload, and export.
