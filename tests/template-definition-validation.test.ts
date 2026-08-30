import { describe, expect, it } from "vitest";
import { validateDiscoveredTemplate } from "../src/cli/check";
import type { DiscoveredTemplate } from "../src/cli/project-templates";

function templateDefinition(): DiscoveredTemplate {
  return {
    exportName: "card",
    filePath: "/project/vanillasky/templates/card.tsx",
    importPath: "./templates/card",
    metadata: {
      id: "card",
      label: "Card",
      useWhen: "Show a concise card.",
      usesGlobalTextEffect: false,
      usesGlobalTransition: false,
      usesGlobalBackgroundEffect: false,
      schema: {
        type: "object",
        properties: { title: { type: "string", default: "Ready" } },
        required: ["title"],
      },
      minDuration: 2,
      preferredDuration: 4,
    },
    examples: [{ name: "Launch", variables: { title: "Now shipping" } }],
  };
}

function metadataRecord(definition: DiscoveredTemplate): Record<string, unknown> {
  return definition.metadata as unknown as Record<string, unknown>;
}

function schemaRecord(definition: DiscoveredTemplate): Record<string, unknown> {
  return definition.metadata.schema as unknown as Record<string, unknown>;
}

function schemaProperties(definition: DiscoveredTemplate): Record<string, Record<string, unknown>> {
  return definition.metadata.schema.properties as unknown as Record<string, Record<string, unknown>>;
}

type DefinitionMutation = (definition: DiscoveredTemplate) => void;

const setMetadata = (values: Record<string, unknown>): DefinitionMutation =>
  (definition) => { Object.assign(metadataRecord(definition), values); };

const setSchema = (values: Record<string, unknown>): DefinitionMutation =>
  (definition) => { Object.assign(schemaRecord(definition), values); };

const setTitleProperty = (values: Record<string, unknown>): DefinitionMutation =>
  (definition) => { Object.assign(schemaProperties(definition).title, values); };

const setExamples = (examples: unknown): DefinitionMutation =>
  (definition) => { definition.examples = examples; };

describe("project template definition validation", () => {
  it("materializes named examples without executing project source", () => {
    expect(validateDiscoveredTemplate(templateDefinition(), "/project")).toEqual([{
      name: "Launch",
      variables: { title: "Now shipping" },
      enforceRequiredAnyOf: true,
    }]);
  });

  it("accepts grounded numbers and optional empty media sentinels", () => {
    const definition = templateDefinition();
    definition.metadata.schema = {
      type: "object",
      properties: {
        title: { type: "number", format: "grounded-stat", default: 42 },
        mediaUrl: { type: "string", format: "uri", default: "" },
      },
      required: ["title"],
    };
    definition.examples = [{ name: "Launch", variables: { title: 58, mediaUrl: "" } }];

    expect(() => validateDiscoveredTemplate(definition, "/project")).not.toThrow();
  });

  it("accepts declared conditional presence groups", () => {
    const definition = templateDefinition();
    definition.metadata.schema = {
      ...definition.metadata.schema,
      "x-vanillasky": { requiredAnyOf: [["title"]] },
    };

    expect(() => validateDiscoveredTemplate(definition, "/project")).not.toThrow();
  });

  it("rejects named examples without conditionally required content", () => {
    const definition = templateDefinition();
    definition.metadata.schema = {
      type: "object",
      properties: {
        title: { type: "string", default: "Ready" },
        cta: { type: "string", default: "" },
      },
      required: ["title"],
      "x-vanillasky": { requiredAnyOf: [["cta"]] },
    };

    expect(() => validateDiscoveredTemplate(definition, "/project")).toThrow(
      'example "Launch" requires a non-empty value for cta',
    );
  });

  it("treats defaults-only fixtures as renderer smoke data", () => {
    const definition = templateDefinition();
    definition.metadata.schema = {
      type: "object",
      properties: {
        title: { type: "string", default: "Ready" },
        cta: { type: "string", default: "" },
      },
      required: ["title"],
      "x-vanillasky": { requiredAnyOf: [["cta"]] },
    };
    delete definition.examples;

    expect(validateDiscoveredTemplate(definition, "/project")).toEqual([{
      name: "defaults",
      variables: { title: "Ready", cta: "" },
      enforceRequiredAnyOf: false,
    }]);
  });

  it("keeps required media URLs strict when the empty sentinel is used", () => {
    const definition = templateDefinition();
    definition.metadata.schema = {
      type: "object",
      properties: { title: { type: "string", format: "uri", default: "" } },
      required: ["title"],
    };

    expect(() => validateDiscoveredTemplate(definition, "/project")).toThrow(
      "schema.properties.title.default must be a valid URL",
    );
  });

  it.each<[string, DefinitionMutation, string]>([
    ["unsupported schema keywords", setTitleProperty({ pattern: "x" }),
      "schema.properties.title.pattern is not supported"],
    ["unsupported schema formats", setTitleProperty({ format: "email" }),
      "schema.properties.title.format is not supported"],
    ["invalid VanillaSky schema extensions", setSchema({ "x-vanillasky": "invalid" }),
      "schema.x-vanillasky must be an object"],
    ["conditional presence groups with undeclared fields", setSchema({ "x-vanillasky": { requiredAnyOf: [["missing"]] } }),
      'schema.x-vanillasky.requiredAnyOf[0] references undeclared property "missing"'],
    ["empty conditional presence groups", setSchema({ "x-vanillasky": { requiredAnyOf: [[]] } }),
      "schema.x-vanillasky.requiredAnyOf[0] must contain at least one property"],
    ["invalid defaults", setTitleProperty({ default: 3 }),
      "schema.properties.title.default must be string"],
    ["invalid URL defaults", setTitleProperty({ format: "uri", default: "not a URL" }),
      "schema.properties.title.default must be a valid URL"],
    ["invalid named examples", setExamples([{ name: "Broken", variables: { title: 3 } }]),
      'example "Broken".title must be string'],
    ["invalid duration ranges", setMetadata({ minDuration: 5 }),
      "minDuration must not exceed preferredDuration"],
    ["unknown metadata fields", setMetadata({ internalOnly: true }),
      "metadata.internalOnly is not supported"],
    ["invalid metadata field types", setMetadata({ label: 3 }), "label must be string"],
    ["null metadata fields", setMetadata({ label: null }), "label must be string"],
    ["falsy invalid metadata collections", setMetadata({ jobs: "" }),
      "jobs contains an unsupported value"],
    ["duplicate metadata jobs", setMetadata({ jobs: ["proof", "proof"] }),
      'jobs contains duplicate value "proof"'],
    ["unknown manifest families", setMetadata({ family: "Internal grouping" }),
      "family contains an unsupported value"],
    ["timing fields that are absent from the schema", setMetadata({ timing: { contentFields: ["missing"], contentUnit: "words" } }),
      'timing.contentFields references undeclared property "missing"'],
    ["schema keywords on the wrong property type", setTitleProperty({ minimum: 1 }),
      "schema.properties.title.minimum is only supported for numbers"],
    ["invalid nested schema containers", setTitleProperty({ type: "object", properties: {}, additionalProperties: "yes", default: {} }),
      "schema.properties.title.additionalProperties must be boolean"],
    ["null schema keyword values", setTitleProperty({ title: null }),
      "schema.properties.title.title must be string"],
    ["null VanillaSky schema extensions", setSchema({ "x-vanillasky": null }),
      "schema.x-vanillasky must be an object"],
    ["named examples that are not arrays", setExamples({ name: "Launch", variables: { title: "Now shipping" } }),
      "examples must be an array"],
    ["null named examples", setExamples(null), "examples must be an array"],
    ["named examples with non-object variables", setExamples([{ name: "Launch", variables: null }]),
      'example "Launch" variables must be a plain object'],
  ])("rejects %s", (_name, mutate, message) => {
    const definition = templateDefinition();
    mutate(definition);

    expect(() => validateDiscoveredTemplate(definition, "/project")).toThrow(message);
  });
});
