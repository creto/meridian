# Final Form.io parity report

## Upstream

- package: @formio/js
- version: 5.2.4
- license: MIT
- integrity: sha512-mQfZ/Vd5cVpCCLnPhZVXTA99F1Jq86W1VU+bx17m95YYQXwyajhXUijtki5be3Xk9DH5spYxajB4Q4XVy5Udzw==
- repository: https://github.com/formio/formio.js
- git commit: not published inside the npm tarball; the integrity hash above pins the artifact
- extracted: 2026-09-28T17:36:05.988Z

## Component registry

- address
- button
- checkbox
- columns
- container
- content
- currency
- datagrid
- datamap
- datetime
- day
- editgrid
- email
- fieldset
- file
- form
- hidden
- htmlelement
- number
- panel
- password
- phoneNumber
- radio
- recaptcha
- select
- selectboxes
- signature
- survey
- table
- tabs
- tags
- textarea
- textfield
- time
- url
- well

## Effective settings count

- Address: 70
- Button: 45
- Checkbox: 53
- Columns: 25
- Container: 49
- Content: 24
- Currency: 69
- Data Grid: 65
- Data Map: 56
- Date / Time: 77
- Day: 72
- Edit Grid: 70
- Email: 74
- Field Set: 27
- File: 74
- Nested Form: 37
- Hidden: 28
- HTML Element: 28
- Number: 72
- Panel: 39
- Password: 63
- Phone Number: 71
- Radio: 64
- recaptcha: 16
- Select: 100
- Select Boxes: 67
- Signature: 55
- Survey: 55
- Table: 31
- Tabs: 25
- Tags: 58
- Text Area: 87
- Text Field: 79
- Time: 58
- Url: 72
- Well: 24

## Parity summary

- applicable settings: 1979
- unique property paths: 304
- FULL: 809
- PARTIAL: 1022
- INTENTIONALLY_UNSUPPORTED: 148
- NOT_APPLICABLE (ignored/help/buttons, excluded from the applicable total): see inventory
- MISSING: 0
- full-runtime percentage of applicable settings: 40.9%

Every applicable setting has inspector UI and lossless persistence. The percentage above is runtime behavior, not whether the control exists.

## Runtime strategy

Meridian keeps its native renderer. `@formio/js` supplies the registry, default schemas, and edit-form definitions. See docs/architecture/ADR-FORMIO-RUNTIME-PARITY.md.

## Security exceptions

customConditional, validate.custom, customDefaultValue, and JavaScript calculateValue are stored and shown. Strict mode does not execute them. Safe expressions and JSON Logic conditionals do run.

## Tests

- src/lib/forms/formio/parity.test.ts
- scripts/formio-parity.test.mjs
- src/lib/forms/formio-registry.test.ts

## Known limitations

- reCAPTCHA is not executed.
- Nested Form does not load a Form.io server resource.
- Authenticated URL fetches, Form.io resources, and IndexedDB sources are stored only.
- encrypted, unique, and dbIndex do not create a cipher or a database index by themselves.
- Logic custom actions are stored and are not executed.
