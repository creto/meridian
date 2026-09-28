# Date / Time

Type `datetime`. Group `advanced`. 77 effective settings.

## Default schema

```json
{
  "input": true,
  "key": "dateTime",
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
  "label": "Date / Time",
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
  "type": "datetime",
  "format": "yyyy-MM-dd hh:mm a",
  "useLocaleSettings": false,
  "allowInput": true,
  "enableDate": true,
  "enableTime": true,
  "defaultDate": "",
  "displayInTimezone": "viewer",
  "timezone": "",
  "datepickerMode": "day",
  "datePicker": {
    "showWeeks": true,
    "startingDay": 0,
    "initDate": "",
    "minMode": "day",
    "maxMode": "year",
    "yearRows": 4,
    "yearColumns": 5,
    "minDate": null,
    "maxDate": null
  },
  "timePicker": {
    "hourStep": 1,
    "minuteStep": 1,
    "showMeridian": true,
    "readonlyInput": false,
    "mousewheel": true,
    "arrowkeys": true
  },
  "customOptions": {}
}
```

## Settings

### Display

- `label` (textfield) — FULL. The label for this field that will appear next to it.
- `labelPosition` (select) — FULL. Position for the label for this field.
- `labelWidth` (number) — PARTIAL. The width of label on line in percentages.
- `labelMargin` (number) — PARTIAL. The width of label margin on line in percentages.
- `displayInTimezone` (select) — PARTIAL. This will display the captured date time in the select timezone.
- `timezone` (select) — PARTIAL. Select the timezone you wish to display this Date
- `useLocaleSettings` (checkbox) — PARTIAL. Use locale settings to display date and time.
- `allowInput` (checkbox) — PARTIAL. Check this if you would like to allow the user to manually enter in the date.
- `format` (textfield) — PARTIAL. The date format for displaying the datetime value.
- `placeholder` (textfield) — FULL. The placeholder text that will appear when this field is empty.
- `description` (textarea) — FULL. The description is text that will appear below the input field.
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
- `shortcutButtons` (editgrid) — PARTIAL. Shortcut Buttons

### Date

- `enableDate` (checkbox) — PARTIAL. Enables date input for this field.
- `datePicker.disable` (tags) — PARTIAL. Add dates that you want to blacklist. For example: 
 
 2025-02-21
- `datePicker.disableFunction` (textarea) — PARTIAL. Disabling dates by a function
- `datePicker.disableWeekends` (checkbox) — PARTIAL. Check to disable weekends
- `datePicker.disableWeekdays` (checkbox) — PARTIAL. Check to disable weekdays

### Time

- `enableTime` (checkbox) — PARTIAL. Enables time input for this field.
- `timePicker.hourStep` (number) — PARTIAL. The number of hours to increment/decrement in the time picker.
- `timePicker.minuteStep` (number) — PARTIAL. The number of minutes to increment/decrement in the time picker.
- `timePicker.showMeridian` (checkbox) — PARTIAL. Display time in 12 hour time with AM/PM.

### Data

- `multiple` (checkbox) — FULL. Allows multiple values to be entered for this field.
- `defaultValue` (textfield) — FULL. The Default Value will be the value for this field, before user interaction. Having a default value will override the placeholder text.
- `defaultDate` (textfield) — PARTIAL. You can use Moment.js functions to set the default value to a specific date. For example: 
 
 moment().subtract(10, 'days')
- `customOptions` (textarea) — PARTIAL. A raw JSON object to use as options for the Date / Time component (Flatpickr).
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
- `validate.required` (checkbox) — FULL. A required field must be filled in before the form can be submitted.
- `enableMinDateInput` (checkbox) — PARTIAL. Enables to use input for moment functions instead of calendar.
- `datePicker.minDate` (textfield) — PARTIAL. The minimum date that can be picked. You can also use Moment.js functions. For example: moment().subtract(10, 'days')
- `enableMaxDateInput` (checkbox) — PARTIAL. Enables to use input for moment functions instead of calendar.
- `datePicker.maxDate` (textfield) — PARTIAL. The maximum date that can be picked. You can also use Moment.js functions. For example: moment().add(10, 'days')
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
