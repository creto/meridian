# Day

Type `day`. Group `advanced`. 72 effective settings.

## Default schema

```json
{
  "input": true,
  "key": "day",
  "placeholder": "",
  "prefix": "",
  "customClass": "",
  "suffix": "",
  "multiple": false,
  "defaultValue": "",
  "protected": false,
  "unique": false,
  "persistent": true,
  "hidden": false,
  "clearOnHide": true,
  "refreshOn": "",
  "redrawOn": "",
  "tableView": false,
  "modalEdit": false,
  "label": "Day",
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
  "widget": null,
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
  "type": "day",
  "fields": {
    "day": {
      "type": "number",
      "placeholder": "",
      "required": false
    },
    "month": {
      "type": "select",
      "placeholder": "",
      "required": false
    },
    "year": {
      "type": "number",
      "placeholder": "",
      "required": false
    }
  },
  "dayFirst": false
}
```

## Settings

### Display

- `label` (textfield) — FULL. The label for this field that will appear next to it.
- `hideInputLabels` (checkbox) — PARTIAL. Hide the labels of component inputs. This allows you to show the labels in the form builder, but not when it is rendered.
- `labelWidth` (number) — PARTIAL. The width of label on line in percentages.
- `labelMargin` (number) — PARTIAL. The width of label margin on line in percentages.
- `inputsLabelPosition` (select) — PARTIAL. Position for the labels for inputs for this field.
- `description` (textarea) — FULL. The description is text that will appear below the input field.
- `useLocaleSettings` (checkbox) — PARTIAL. Use locale settings to display day.
- `tooltip` (textarea) — FULL. Adds a tooltip to the side of this field.
- `customClass` (textfield) — FULL. Custom CSS class to add to this component.
- `tabindex` (textfield) — FULL. Sets the tabindex attribute of this component to override the tab order of the form. See the <a href='https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex'>MDN documentation</a> on tabindex for more information.
- `hidden` (checkbox) — FULL. A hidden field is still a part of the form, but is hidden from view.
- `hideLabel` (checkbox) — FULL. Hide the label (title, if no label) of this component. This allows you to show the label in the form builder, but not when it is rendered.
- `autofocus` (checkbox) — FULL. Make this field the initially focused element on this form.
- `dataGridLabel` (checkbox) — PARTIAL. Show the label inside each row when in a Datagrid.
- `disabled` (checkbox) — FULL. Disable the form input.
- `tableView` (checkbox) — FULL. Shows this value within the table view of the submissions.
- `modalEdit` (checkbox) — PARTIAL. Opens up a modal to edit the value of this component.

### Day

- `fields.day.type` (select) — PARTIAL. Type
- `fields.day.placeholder` (textfield) — PARTIAL. The placeholder text that will appear when Day field is empty.
- `fields.day.hide` (checkbox) — PARTIAL. Hide the Day part of the component.
- `dayFirst` (checkbox) — PARTIAL. Display the Day field before the Month field.

### Month

- `fields.month.type` (select) — PARTIAL. Type of input
- `fields.month.placeholder` (textfield) — PARTIAL. The placeholder text that will appear when Month field is empty.
- `fields.month.hide` (checkbox) — PARTIAL. Hide the Month part of the component.

### Year

- `fields.year.type` (select) — PARTIAL. Type of input
- `fields.year.minYear` (number) — PARTIAL. The minimum year that can be entered.
- `fields.year.maxYear` (number) — PARTIAL. The maximum year that can be entered.
- `fields.year.placeholder` (textfield) — PARTIAL. The placeholder text that will appear when Year field is empty.
- `fields.year.hide` (checkbox) — PARTIAL. Hide the Year part of the component.

### Data

- `defaultValue` (textfield) — FULL. The Default Value will be the value for this field, before user interaction. Having a default value will override the placeholder text.
- `persistent` (radio) — FULL. A persistent field will be stored in database when the form is submitted.
- `protected` (checkbox) — FULL. A protected field will not be returned when queried via API.
- `dbIndex` (checkbox) — PARTIAL. Set this field as an index within the database. Increases performance for submission queries.
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
- `fields.day.required` (checkbox) — PARTIAL. A required field must be filled in before the form can be submitted.
- `fields.month.required` (checkbox) — PARTIAL. A required field must be filled in before the form can be submitted.
- `fields.year.required` (checkbox) — PARTIAL. A required field must be filled in before the form can be submitted.
- `maxDate` (textfield) — PARTIAL. A maximum day that can be set. You can also use Moment.js functions. For example: 
 
 moment().add(10, 'days')
- `minDate` (textfield) — PARTIAL. A minimum date that can be set. You can also use Moment.js functions. For example: 
 
 moment().subtract(10, 'days')
- `unique` (checkbox) — PARTIAL. Makes sure the data submitted for this field is unique, and has not been submitted before.
- `validateWhenHidden` (checkbox) — PARTIAL. Validates the component when it is hidden/conditionally hidden. Vaildation errors are displayed in the error alert on the form submission. Use caution when enabling this setting, as it can cause a hidden component to be invalid with no way for the form user to correct it.
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
