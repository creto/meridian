# Edit Grid

Type `editgrid`. Group `data`. 70 effective settings.

## Default schema

```json
{
  "input": true,
  "key": "editGrid",
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
  "tableView": false,
  "modalEdit": false,
  "label": "Edit Grid",
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
  "tree": true,
  "lazyLoad": false,
  "disableAddingRemovingRows": false,
  "type": "editgrid",
  "removeRow": "Cancel",
  "defaultOpen": false,
  "openWhenEmpty": false,
  "modal": false,
  "components": [],
  "inlineEdit": false,
  "templates": {
    "header": "<div class=\"row\">\n      {% util.eachComponent(components, function(component) { %}\n        {% if (displayValue(component)) { %}\n          <div class=\"col-sm-2\">{{ t(component.label) }}</div>\n        {% } %}\n      {% }) %}\n    </div>",
    "row": "<div class=\"row\">\n      {% util.eachComponent(components, function(component) { %}\n        {% if (displayValue(component)) { %}\n          <div class=\"col-sm-2\">\n            {{ isVisibleInRow(component) ? getView(component, row[component.key]) : ''}}\n          </div>\n        {% } %}\n      {% }) %}\n      {% if (!instance.options.readOnly && !instance.disabled) { %}\n        <div class=\"col-sm-2\">\n          <div class=\"btn-group pull-right\">\n            <button class=\"btn btn-default btn-light btn-sm editRow\"><i class=\"{{ iconClass('edit') }}\"></i></button>\n            {% if (!instance.hasRemoveButtons || instance.hasRemoveButtons()) { %}\n              <button class=\"btn btn-danger btn-sm removeRow\"><i class=\"{{ iconClass('trash') }}\"></i></button>\n            {% } %}\n          </div>\n        </div>\n      {% } %}\n    </div>",
    "tableHeader": "\n      <tr>\n        {% util.eachComponent(components, function(component) { %}\n          {% if (!component.hasOwnProperty('tableView') || component.tableView) { %}\n            <td class=\"editgrid-table-column\">{{ component.label }}</td>\n          {% } %}\n        {% }) %}\n        {% if (!instance.options.readOnly && !instance.disabled) { %}\n          <td class=\"editgrid-table-column\">Actions</td>\n        {% } %}\n      </tr>\n    ",
    "tableRow": "\n      {% util.eachComponent(components, function(component) { %}\n          {% if (!component.hasOwnProperty('tableView') || component.tableView) { %}\n            <td class=\"editgrid-table-column\">\n              {{ getView(component, row[component.key]) }}\n            </td>\n          {% } %}\n        {% }) %}\n        {% if (!instance.options.readOnly && !instance.disabled) { %}\n          <td class=\"editgrid-table-column\">\n            <div class=\"btn-group\">\n              <button class=\"btn btn-default btn-light btn-sm editRow\" aria-label=\"{{ t('Edit row') }}\"><i class=\"{{ iconClass('edit') }}\"></i></button>\n              {% if (!instance.hasRemoveButtons || instance.hasRemoveButtons()) { %}\n              <button class=\"btn btn-danger btn-sm removeRow\" aria-label=\"{{ t('Remove row') }}\"><i class=\"{{ iconClass('trash') }}\"></i></button>\n 
```

## Settings

### Display

- `label` (textfield) — FULL. The label for this field that will appear next to it.
- `labelPosition` (select) — FULL. Position for the label for this field.
- `labelWidth` (number) — PARTIAL. The width of label on line in percentages.
- `labelMargin` (number) — PARTIAL. The width of label margin on line in percentages.
- `description` (textarea) — FULL. The description is text that will appear below the input field.
- `tooltip` (textarea) — FULL. Adds a tooltip to the side of this field.
- `customClass` (textfield) — FULL. Custom CSS class to add to this component.
- `tabindex` (textfield) — FULL. Sets the tabindex attribute of this component to override the tab order of the form. See the <a href='https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex'>MDN documentation</a> on tabindex for more information.
- `openWhenEmpty` (checkbox) — PARTIAL. Check this if you would like to open up the first row when the EditGrid is empty
- `disableAddingRemovingRows` (checkbox) — PARTIAL. Check if you want to hide Add Another button and Remove Row button
- `displayAsTable` (checkbox) — PARTIAL. use Table Template
- `conditionalAddButton` (textarea) — PARTIAL. Specify condition when Add Button should be displayed.
- `hidden` (checkbox) — FULL. A hidden field is still a part of the form, but is hidden from view.
- `hideLabel` (checkbox) — FULL. Hide the label (title, if no label) of this component. This allows you to show the label in the form builder, but not when it is rendered.
- `autofocus` (checkbox) — FULL. Make this field the initially focused element on this form.
- `dataGridLabel` (checkbox) — PARTIAL. Show the label inside each row when in a Datagrid.
- `disabled` (checkbox) — FULL. Disable the form input.
- `tableView` (checkbox) — FULL. Shows this value within the table view of the submissions.
- `modalEdit` (checkbox) — PARTIAL. Opens up a modal to edit the value of this component.

### Templates

- `templates.header` (textarea) — PARTIAL. This is the <a href='https://lodash.com/docs/4.17.5#template'>Lodash Template</a> used to render the header of the Edit grid.
- `templates.tableHeader` (textarea) — PARTIAL. This is the <a href='https://lodash.com/docs/4.17.5#template'>Lodash Template</a> used to render the header of the Edit grid.
- `templates.row` (textarea) — PARTIAL. This is the <a href='https://lodash.com/docs/4.17.5#template'>Lodash Template</a> used to render each row of the Edit grid.
- `templates.tableRow` (textarea) — PARTIAL. This is the <a href='https://lodash.com/docs/4.17.5#template'>Lodash Template</a> used to render each row of the Edit grid.
- `templates.footer` (textarea) — PARTIAL. This is the <a href='https://lodash.com/docs/4.17.5#template'>Lodash Template</a> used to render the footer of the Edit grid.
- `rowClass` (textfield) — PARTIAL. CSS class to add to the edit row wrapper.
- `addAnother` (textfield) — PARTIAL. Set the text of the Add Another button.
- `modal` (checkbox) — PARTIAL. Display a modal to add or edit entries in the table
- `saveRow` (textfield) — PARTIAL. Set the text of the Save Row button.
- `removeRow` (textfield) — PARTIAL. Set the text of the remove Row button.

### Data

- `persistent` (radio) — FULL. A persistent field will be stored in database when the form is submitted.
- `inlineEdit` (checkbox) — PARTIAL. Check this if you would like your changes within 'edit' mode to be committed directly to the submission object as that row is being changed
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
- `validateWhenHidden` (checkbox) — PARTIAL. Validates the component when it is hidden/conditionally hidden. Vaildation errors are displayed in the error alert on the form submission. Use caution when enabling this setting, as it can cause a hidden component to be invalid with no way for the form user to correct it.
- `rowDrafts` (checkbox) — PARTIAL. Allow save rows even if their data is invalid. Errors will occur when try to submit with invalid rows.
- `validate.minLength` (number) — FULL. The minimum length requirement this field must meet.
- `validate.maxLength` (number) — FULL. The maximum length requirement this field must meet.
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
