# Select

Type `select`. Group `basic`. 100 effective settings.

## Default schema

```json
{
  "input": true,
  "key": "select",
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
  "label": "Select",
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
    "unique": false,
    "onlyAvailableItems": false
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
  "dataSrc": "values",
  "authenticate": false,
  "ignoreCache": false,
  "template": "<span>{{ item.label }}</span>",
  "type": "select",
  "idPath": "id",
  "data": {
    "values": [
      {
        "label": "",
        "value": ""
      }
    ],
    "json": "",
    "url": "",
    "resource": "",
    "custom": ""
  },
  "clearOnRefresh": false,
  "limit": 100,
  "valueProperty": "",
  "lazyLoad": true,
  "filter": "",
  "searchEnabled": true,
  "searchDebounce": 0.3,
  "searchField": "",
  "minSearch": 0,
  "readOnlyValue": false,
  "selectFields": "",
  "selectThreshold": 0.3,
  "uniqueOptions": false,
  "fuseOptions": {
    "include": "score",
    "threshold": 0.3
  },
  "indexeddb": {
    "filter": {}
  },
  "customOptions": {},
  "useExactSearch": false
}
```

## Settings

### Display

- `label` (textfield) — FULL. The label for this field that will appear next to it.
- `labelPosition` (select) — FULL. Position for the label for this field.
- `widget` (select) — PARTIAL. Select the type of widget you'd like to use.
- `labelWidth` (number) — PARTIAL. The width of label on line in percentages.
- `labelMargin` (number) — PARTIAL. The width of label margin on line in percentages.
- `placeholder` (textfield) — FULL. The placeholder text that will appear when this field is empty.
- `description` (textarea) — FULL. The description is text that will appear below the input field.
- `tooltip` (textarea) — FULL. Adds a tooltip to the side of this field.
- `customClass` (textfield) — FULL. Custom CSS class to add to this component.
- `tabindex` (textfield) — FULL. Sets the tabindex attribute of this component to override the tab order of the form. See the <a href='https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex'>MDN documentation</a> on tabindex for more information.
- `hidden` (checkbox) — FULL. A hidden field is still a part of the form, but is hidden from view.
- `hideLabel` (checkbox) — FULL. Hide the label (title, if no label) of this component. This allows you to show the label in the form builder, but not when it is rendered.
- `uniqueOptions` (checkbox) — PARTIAL. Display only unique dropdown options.
- `autofocus` (checkbox) — FULL. Make this field the initially focused element on this form.
- `dataGridLabel` (checkbox) — PARTIAL. Show the label inside each row when in a Datagrid.
- `disabled` (checkbox) — FULL. Disable the form input.
- `tableView` (checkbox) — FULL. Shows this value within the table view of the submissions.
- `modalEdit` (checkbox) — PARTIAL. Opens up a modal to edit the value of this component.

### Data

- `multiple` (checkbox) — FULL. Allows multiple values to be entered for this field.
- `dataSrc` (select) — FULL. The source to use for the select data. Values lets you provide your own values and labels. JSON lets you provide raw JSON data. URL lets you provide a URL to retrieve the JSON data from.
- `defaultValue` (textfield) — FULL. The Default Value will be the value for this field, before user interaction. Having a default value will override the placeholder text.
- `data.url` (textfield) — FULL. A URL that returns a JSON array to use as the data source.
- `indexeddb.database` (textfield) — PARTIAL. The name of the indexeddb database.
- `data.json` (textarea) — FULL. A valid JSON array to use as a data source.
- `data.values` (datagrid) — FULL. Values to use as the data source. Labels are shown in the select field. Values are the corresponding values saved with the submission.
- `data.resource` (select) — PARTIAL. The resource to be used with this field.
- `data.headers` (datagrid) — PARTIAL. Set any headers that should be sent along with the request to the url. This is useful for authentication.
- `lazyLoad` (checkbox) — PARTIAL. When set, this will not fire off the request to the URL until this control is within focus. This can improve performance if you have many Select dropdowns on your form where the API's will only fire when the control is activated.
- `valueProperty` (select) — FULL. The field to use as the value.
- `selectValues` (textfield) — FULL. The property within the source data, where iterable items reside. For example: results.items or results[0].items
- `dataType` (select) — PARTIAL. The type to store the data. If you select something other than autotype, it will force it to that type.
- `idPath` (textfield) — PARTIAL. Path to the select option id.
- `valueProperty` (textfield) — FULL. The property of each item in the data source to use as the select value. If not specified, the item itself will be used.
- `selectFields` (textfield) — PARTIAL. The properties on the resource to return as part of the options. Separate property names by commas. If left blank, all properties will be returned.
- `data.custom` (textarea) — PARTIAL. Write custom code to return the value options or a promise with value options. The form data object is available.
- `disableLimit` (checkbox) — PARTIAL. When enabled the request will not include the limit and skip options in the query string
- `indexeddb.table` (textfield) — PARTIAL. The name of table in the indexeddb database.
- `searchField` (textfield) — PARTIAL. The name of the search querystring parameter used when sending a request to filter results with. The server at the URL must handle this query parameter.
- `searchDebounce` (number) — PARTIAL. The delay in seconds before the search request is sent, measured from the last character input in the search field.
- `minSearch` (number) — PARTIAL. The minimum amount of characters they must type before a search is made.
- `template` (textarea) — PARTIAL. The HTML template for the result data items.
- `indexeddb.filter` (textarea) — PARTIAL. Filter table items that match the object.
- `filter` (textfield) — PARTIAL. Use this to provide additional filtering using query parameters.
- `sort` (textfield) — PARTIAL. Use this to provide additional sorting using query parameters
- `limit` (number) — PARTIAL. Use this to limit the number of items to request or view.
- `refreshOn` (select) — PARTIAL. Refresh data when another field changes.
- `refreshOnBlur` (select) — PARTIAL. Refresh data when another field is blured.
- `clearOnRefresh` (checkbox) — PARTIAL. When the Refresh On field is changed, clear this components value.
- `searchEnabled` (checkbox) — PARTIAL. When checked, the select dropdown will allow for searching within the static list of items provided.
- `noRefreshOnScroll` (checkbox) — PARTIAL. When checked, the select with search input won't perform new api requests when scrolling through the list of options.
- `selectThreshold` (number) — PARTIAL. At what point does the match algorithm give up. A threshold of 0.0 requires a perfect match, a threshold of 1.0 would match anything.
- `addResource` (checkbox) — PARTIAL. Allows to create a new resource while entering a submission.
- `addResourceLabel` (textfield) — PARTIAL. Set the text of the Add Resource button.
- `reference` (checkbox) — PARTIAL. Using this option will save this field as a reference and link its value to the value of the origin record.
- `authenticate` (checkbox) — PARTIAL. Check this if you would like to use Formio Authentication with the request.
- `readOnlyValue` (checkbox) — PARTIAL. Check this if you would like to show just the value when in Read Only mode.
- `customOptions` (textarea) — PARTIAL. A raw JSON object to use as options for the Select component (Choices JS).
- `ignoreCache` (checkbox) — PARTIAL. Check it if you don't want the requests and its results to be stored in the cache. By default, it is stored and if the Select tries to make the request to the same URL with the same paremetrs, the cached data will be returned. It allows to increase performance, but if the remote source's data is changing quite often and you always need to keep it up-to-date, uncheck this option.
- `useExactSearch` (checkbox) — PARTIAL. Disables search algorithm threshold.
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
- `selectData` (textfield) — PARTIAL.

### Validation

- `validateOn` (select) — PARTIAL. Determines when this component should trigger front-end validation.
- `validate.required` (checkbox) — FULL. A required field must be filled in before the form can be submitted.
- `validate.select` (checkbox) — PARTIAL. Check this if you would like for the server to perform a validation check to ensure the selected value is an available option. This requires a Search query to ensure a record is found.
- `validate.onlyAvailableItems` (checkbox) — PARTIAL. Check this if you would like to perform a validation check to ensure the selected value is an available option (only for synchronous values).
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
