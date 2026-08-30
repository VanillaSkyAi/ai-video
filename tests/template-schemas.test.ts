import { describe, expect, it } from "vitest";
import * as schemasModule from "../src/visual-system/scene-templates/schemas";

const BACKGROUND_MEDIA_PROPERTY_NAMES = [
  "mediaUrl",
  "mediaKeyword",
  "mediaType",
  "mediaPoster",
  "mediaPosition",
  "mediaTreatment",
] as const;

describe("built-in template schema properties", () => {
  it("creates independent background-media property groups", () => {
    const factory = (schemasModule as unknown as Record<string, unknown>)
      .createBackgroundMediaSchemaProperties;

    expect(factory).toBeTypeOf("function");
    if (typeof factory !== "function") return;

    const first = factory() as Record<string, unknown>;
    const second = factory() as Record<string, unknown>;
    const canonical = schemasModule.BUILTIN_TEMPLATE_SCHEMAS.media.properties;

    expect(Object.keys(first)).toEqual(BACKGROUND_MEDIA_PROPERTY_NAMES);
    expect(first).toEqual(second);
    for (const name of BACKGROUND_MEDIA_PROPERTY_NAMES) {
      expect(first[name]).toEqual(canonical[name]);
      expect(first[name]).not.toBe(second[name]);
    }
  });

  it("keeps supplied background keywords out of stock-media resolution", () => {
    const factory = (schemasModule as unknown as Record<string, unknown>)
      .createBackgroundMediaSchemaProperties;

    expect(factory).toBeTypeOf("function");
    if (typeof factory !== "function") return;

    const properties = factory({ stockMediaKeyword: false }) as Record<string, Record<string, unknown>>;

    expect(properties.mediaKeyword).toEqual(
      schemasModule.BUILTIN_TEMPLATE_SCHEMAS.phoneMockup.properties.mediaKeyword,
    );
    expect(properties.mediaKeyword).not.toHaveProperty("format");
  });
});
