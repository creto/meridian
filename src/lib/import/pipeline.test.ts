import assert from "node:assert/strict";
import test from "node:test";
import { chooseImporter, csvImporter, jsonSampleImporter, jsonSchemaImporter } from "./pipeline.ts";

test("CSV profiles Email as email and Id as an identifier", () => {
  const csv = "Id,Email,City\n1,ada@example.com,Bogota\n2,ben@example.com,Lima\n3,cy@example.com,Bogota\n";
  const importer = chooseImporter(csv);
  assert.equal(importer, csvImporter);
  const profiles = importer?.profile(csv) ?? [];
  const email = profiles.find((profile) => profile.field === "Email");
  const id = profiles.find((profile) => profile.field === "Id");
  assert.equal(email?.inferredType, "email");
  assert.ok((email?.confidence ?? 0) > 0);
  assert.ok((id?.identifierLikelihood ?? 0) > 0.6);
  const city = profiles.find((profile) => profile.field === "City");
  assert.equal(city?.enumCandidate, true);
  const form = csvImporter.convert(csv);
  assert.equal(form.title, "Imported CSV");
  assert.ok(form.components.length >= 3);
});

test("chooseImporter selects the JSON Schema importer", () => {
  const schema = { type: "object", properties: { name: { type: "string" } } };
  const importer = chooseImporter(schema);
  assert.equal(importer, jsonSchemaImporter);
  assert.equal(importer?.kind, "json-schema");
  const form = importer?.convert(schema);
  assert.equal(typeof form?.title, "string");
  assert.ok((form?.components.length ?? 0) >= 1);
  const sample = chooseImporter({ name: "Ada", age: 30, active: true });
  assert.equal(sample, jsonSampleImporter);
  const profiles = sample?.profile({ name: "Ada", age: 30, active: false }) ?? [];
  assert.equal(profiles.find((profile) => profile.field === "name")?.inferredType, "string");
  assert.equal(profiles.find((profile) => profile.field === "age")?.inferredType, "number");
  assert.equal(profiles.find((profile) => profile.field === "active")?.inferredType, "boolean");
});
