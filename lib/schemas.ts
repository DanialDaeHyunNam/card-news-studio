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

export const generateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["theme", "cards"],
  properties: {
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
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
    radius: { type: "number" },
    fit: { type: "string", enum: ["cover", "contain"] },
    dim: { type: "number" },
    opacity: { type: "number" },
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
      ],
    },
    cardId: { type: "string" },
    elementId: { type: "string" },
    role: { type: "string" }, // for update_style
    index: { type: "number" },
    patch: patchSchema,
    element: anyElement,
    card: cardSchema,
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
