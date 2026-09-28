# File

Type `file`. Group `premium`. 74 effective settings.

## Default schema

```json
{
  "input": true,
  "key": "file",
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
  "label": "Upload",
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
  "type": "file",
  "image": false,
  "privateDownload": false,
  "imageSize": "200",
  "filePattern": "*",
  "fileMinSize": "0KB",
  "fileMaxSize": "1GB",
  "uploadOnly": false
}
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
- `hidden` (checkbox) — FULL. A hidden field is still a part of the form, but is hidden from view.
- `hideLabel` (checkbox) — FULL. Hide the label (title, if no label) of this component. This allows you to show the label in the form builder, but not when it is rendered.
- `autofocus` (checkbox) — FULL. Make this field the initially focused element on this form.
- `dataGridLabel` (checkbox) — PARTIAL. Show the label inside each row when in a Datagrid.
- `disabled` (checkbox) — FULL. Disable the form input.
- `tableView` (checkbox) — FULL. Shows this value within the table view of the submissions.
- `modalEdit` (checkbox) — PARTIAL. Opens up a modal to edit the value of this component.
- `autoSync` (hidden) — PARTIAL. Enable ability to control files synchronization. Files will be auto synced before submit.

### File

- `storage` (select) — PARTIAL. Which storage to save the files in.
- `useMultipartUpload` (checkbox) — PARTIAL. The <a href='https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html'>S3 Multipart Upload API</a> is designed to improve the upload experience for larger objects (> 5GB).
- `multipart` (container) — PARTIAL. Multipart Upload
- `url` (textfield) — PARTIAL. See <a href='https://github.com/danialfarid/ng-file-upload#server-side' target='_blank'>https://github.com/danialfarid/ng-file-upload#server-side</a> for how to set up the server.
- `options.indexeddb` (textfield) — PARTIAL. Database
- `options.indexeddbTable` (textfield) — PARTIAL. Table
- `options` (textarea) — PARTIAL. Pass your custom xhr options(optional)
- `fileKey` (textfield) — PARTIAL. Key name that you would like to modify for the file while calling API request.
- `dir` (textfield) — PARTIAL. This will place all the files uploaded in this field in the directory
- `fileNameTemplate` (textfield) — PARTIAL. Specify template for name of uploaded file(s). Regular template variables are available (`data`, `component`, `user`, `value`, `moment` etc.), also `fileName`, `guid` variables are available. `guid` part must be present, if not found in template, will be added at the end.
- `image` (checkbox) — PARTIAL. Instead of a list of linked files, images will be rendered in the view.
- `uploadOnly` (checkbox) — PARTIAL. When this is checked, will only allow you to upload file(s) and consequently the download, in this component, will be unavailable.
- `privateDownload` (checkbox) — PARTIAL. When this is checked, the file download will send a POST request to the download URL with the x-jwt-token header. This will allow your endpoint to create a Private download system.
- `imageSize` (textfield) — PARTIAL. The image size for previewing images.
- `webcam` (checkbox) — PARTIAL. This will allow using an attached camera to directly take a picture instead of uploading an existing file.
- `webcamSize` (textfield) — PARTIAL. The webcam size for taking pictures.
- `capture` (radio) — PARTIAL. This will allow a mobile device to open the camera or microphone directly in capture mode.
- `fileTypes` (datagrid) — FULL. Specify file types to classify the uploads. This is useful if you allow multiple types of uploads but want to allow the user to specify which type of file each is.
- `filePattern` (textfield) — FULL. See <a href='https://github.com/danialfarid/ng-file-upload#full-reference' target='_blank'>https://github.com/danialfarid/ng-file-upload#full-reference</a> for how to specify file patterns.
- `fileMinSize` (textfield) — FULL. See <a href='https://github.com/danialfarid/ng-file-upload#full-reference' target='_blank'>https://github.com/danialfarid/ng-file-upload#full-reference</a> for how to specify file sizes.
- `fileMaxSize` (textfield) — FULL. See <a href='https://github.com/danialfarid/ng-file-upload#full-reference' target='_blank'>https://github.com/danialfarid/ng-file-upload#full-reference</a> for how to specify file sizes.

### Data

- `multiple` (checkbox) — FULL. Allows multiple values to be entered for this field.
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

- `validate.required` (checkbox) — FULL. A required field must be filled in before the form can be submitted.
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
