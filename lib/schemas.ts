// JSON schemas for Claude structured outputs (output_config.format).
// Constraint from the API: every object needs additionalProperties: false;
// numeric min/max constraints are not supported, so ranges live in the prompts.

const textElement = {
  type: "object",
  additionalProperties: false,
  required: ["type", "text", "x", "y", "w", "fontSize", "fontWeight", "color", "align", "lineHeight"],
  properties: {
    type: { type: "string", enum: ["text"] },
    role: { type: "string" }, // overline | title | body | caption (or custom)
    text: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    fontSize: { type: "number" },
    fontWeight: { type: "number" },
    color: { type: "string" },
    align: { type: "string", enum: ["left", "center", "right"] },
    lineHeight: { type: "number" },
    fontFamily: { type: "string" },
    letterSpacing: { type: "number" },
    italic: { type: "boolean" },
    underline: { type: "boolean" },
    shadow: { type: "boolean" },
    opacity: { type: "number" },
  },
};

const shapeElement = {
  type: "object",
  additionalProperties: false,
  required: ["type", "x", "y", "w", "h", "color", "radius"],
  properties: {
    type: { type: "string", enum: ["shape"] },
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
    color: { type: "string" },
    radius: { type: "number" },
    opacity: { type: "number" },
  },
};

// Images can only be added by referencing a chat attachment ("attachment:0").
const imageElement = {
  type: "object",
  additionalProperties: false,
  required: ["type", "src", "x", "y", "w", "h", "fit", "radius"],
  properties: {
    type: { type: "string", enum: ["image"] },
    src: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
    fit: { type: "string", enum: ["cover", "contain"] },
    radius: { type: "number" },
    dim: { type: "number" },
    opacity: { type: "number" },
    focusX: { type: "number" },
    focusY: { type: "number" },
    zoom: { type: "number" },
  },
};

const anyElement = { anyOf: [textElement, shapeElement, imageElement] };

const cardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["background", "elements"],
  properties: {
    background: { type: "string" },
    elements: { type: "array", items: anyElement },
  },
};

const briefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["audience", "purpose", "contentType", "keepOriginal", "languageNote"],
  properties: {
    audience: { type: "string" },
    purpose: { type: "string" },
    contentType: { type: "string" },
    keepOriginal: { type: "array", items: { type: "string" } },
    languageNote: { type: "string" },
  },
};

export const generateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["brief", "theme", "cards"],
  properties: {
    brief: briefSchema, // decided FIRST — the copy is written to serve it
    theme: {
      type: "object",
      additionalProperties: false,
      required: ["background", "textColor", "accent", "fontFamily"],
      properties: {
        background: { type: "string" },
        textColor: { type: "string" },
        accent: { type: "string" },
        fontFamily: { type: "string" },
      },
    },
    cards: { type: "array", items: cardSchema },
  },
};

const patchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" },
    role: { type: "string" },
    fontSize: { type: "number" },
    fontWeight: { type: "number" },
    color: { type: "string" },
    align: { type: "string", enum: ["left", "center", "right"] },
    lineHeight: { type: "number" },
    letterSpacing: { type: "number" },
    italic: { type: "boolean" },
    underline: { type: "boolean" },
    shadow: { type: "boolean" },
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
    radius: { type: "number" },
    fit: { type: "string", enum: ["cover", "contain"] },
    dim: { type: "number" },
    opacity: { type: "number" },
    focusX: { type: "number" },
    focusY: { type: "number" },
    zoom: { type: "number" },
    src: { type: "string" }, // image element source (URL or attachment:N)
    background: { type: "string" },
    textColor: { type: "string" },
    accent: { type: "string" },
    fontFamily: { type: "string" },
  },
};

const operationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["op"],
  properties: {
    op: {
      type: "string",
      enum: [
        "update_element",
        "add_element",
        "remove_element",
        "reorder_element",
        "update_card",
        "add_card",
        "remove_card",
        "update_theme",
        "update_style",
        "update_brief",
      ],
    },
    cardId: { type: "string" },
    elementId: { type: "string" },
    role: { type: "string" }, // for update_style
    index: { type: "number" },
    patch: patchSchema,
    element: anyElement,
    card: cardSchema,
    brief: briefSchema, // for update_brief
  },
};

export const chatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "operations"],
  properties: {
    reply: { type: "string" },
    operations: { type: "array", items: operationSchema },
  },
};

// Analysis step (lib/prompts.ts planSystem). Kept flat and enum-constrained so
// every track (Anthropic structured outputs, CLI --json-schema, OpenAI
// json_object) produces the same shape; lib/harness.ts normalizes it anyway.
export const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "referenceLayout", "style", "cardCount", "cards", "sufficient", "needMore", "question", "options"],
  properties: {
    reply: { type: "string" },
    referenceLayout: { type: "string" },
    // The reference's visual + narrative spec, applied to generation AND to the
    // client's photo dressing (lib/photoset.ts RefStyle). Numbers: px @1080 wide.
    style: {
      type: "object",
      additionalProperties: false,
      required: [
        "dim", "scrim", "textColor", "accentColor", "textEffect", "align", "anchor",
        "headlineSize", "bodySize", "headlineWeight", "letterCase", "levels",
        "wordsPerSlide", "hierarchy", "storyPattern", "voice",
      ],
      properties: {
        dim: { type: "number" },
        scrim: { type: "string", enum: ["none", "uniform", "top", "bottom", "text"] },
        textColor: { type: "string" },
        accentColor: { type: "string" },
        textEffect: { type: "string", enum: ["shadow", "none"] },
        align: { type: "string", enum: ["left", "center", "right"] },
        anchor: { type: "string", enum: ["top", "center", "bottom", "free"] },
        headlineSize: { type: "number" },
        bodySize: { type: "number" },
        headlineWeight: { type: "number" },
        letterCase: { type: "string", enum: ["lower", "sentence", "upper", "as-is"] },
        levels: { type: "integer" },
        wordsPerSlide: { type: "integer" },
        hierarchy: { type: "string" },
        storyPattern: { type: "string" },
        voice: { type: "string" },
      },
    },
    cardCount: { type: "integer" },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["layout", "photos", "idea"],
        properties: {
          layout: { type: "string", enum: ["full", "stack2", "side2", "stack3", "grid4", "none"] },
          photos: { type: "array", items: { type: "integer" } },
          idea: { type: "string" },
        },
      },
    },
    sufficient: { type: "boolean" },
    needMore: { type: "integer" },
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
  },
};
