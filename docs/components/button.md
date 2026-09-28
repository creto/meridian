# Button

Type `button`. Group `basic`. 45 effective settings.

## Default schema

```json
{
  "input": true,
  "key": "submit",
  "placeholder": "",
  "prefix": "",
  "customClass": "",
  "suffix": "",
  "multiple": false,
  "defaultValue": null,
  "protected": false,
  "unique": false,
  "persistent": false,
  "hidden": false,
  "clearOnHide": true,
  "refreshOn": "",
  "redrawOn": "",
  "tableView": false,
  "modalEdit": false,
  "label": "Submit",
  "dataGridLabel": true,
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
    "unique": false
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
  "type": "button",
  "size": "md",
  "leftIcon": "",
  "rightIcon": "",
  "block": false,
  "action": "submit",
  "disableOnInvalid": false,
  "theme": "primary"
}
```

## Settings

### Display

- `label` (textfield) — FULL. The label for this field that will appear next to it.
- `labelWidth` (number) — PARTIAL. The width of label on line in percentages.
- `labelMargin` (number) — PARTIAL. The width of label margin on line in percentages.
- `action` (select) — FULL. This is the action to be performed by this button.
- `oauthProvider` (select) — PARTIAL. The oauth provider to use to log in (8.x server only).
- `state` (textfield) — PARTIAL. The state you wish to save the submission under when this button is pressed. Example "draft" would save the submission in Draft Mode.
- `saveOnEnter` (checkbox) — PARTIAL. Use the Enter key to submit form.
- `showValidations` (checkbox) — PARTIAL. When the button is pressed, show any validation errors on the form.
- `event` (textfield) — PARTIAL. The event to fire when the button is clicked.
- `url` (textfield) — PARTIAL. The URL where the submission will be sent.
- `custom` (textarea) — PARTIAL. The custom logic to evaluate when the button is clicked.
- `headers` (datagrid) — PARTIAL. Headers Properties and Values for your request
- `theme` (select) — PARTIAL. The color theme of this button.
- `size` (select) — PARTIAL. The size of this button.
- `block` (checkbox) — PARTIAL. This control should span the full width of the bounding container.
- `leftIcon` (textfield) — PARTIAL. This is the full icon class string to show the icon. Example: 'bi bi-plus'
- `rightIcon` (textfield) — PARTIAL. This is the full icon class string to show the icon. Example: 'bi bi-plus'
- `shortcut` (select) — PARTIAL. Shortcut for this component.
- `description` (textarea) — FULL. The description is text that will appear below the input field.
- `tooltip` (textarea) — FULL. Adds a tooltip to the side of this field.
- `customClass` (textfield) — FULL. Custom CSS class to add to this component.
- `tabindex` (textfield) — FULL. Sets the tabindex attribute of this component to override the tab order of the form. See the <a href='https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex'>MDN documentation</a> on tabindex for more information.
- `disableOnInvalid` (checkbox) — PARTIAL. This will disable this field if the form is invalid.
- `hidden` (checkbox) — FULL. A hidden field is still a part of the form, but is hidden from view.
- `hideLabel` (checkbox) — FULL. Hide the label (title, if no label) of this component. This allows you to show the label in the form builder, but not when it is rendered.
- `autofocus` (checkbox) — FULL. Make this field the initially focused element on this form.
- `disabled` (checkbox) — FULL. Disable the form input.
- `tableView` (checkbox) — FULL. Shows this value within the table view of the submissions.
- `modalEdit` (checkbox) — PARTIAL. Opens up a modal to edit the value of this component.

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
