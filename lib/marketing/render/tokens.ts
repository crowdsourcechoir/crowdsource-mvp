export type EmailTypeStyle = { size: number; lineHeight: number; weight: number; tracking?: number };

export type EmailDesignTokens = {
  schemaVersion: 1;
  emailWidth: number;
  contentWidth: number;
  fonts: { heading: string; body: string; ui: string };
  type: {
    statement: EmailTypeStyle;
    title: EmailTypeStyle;
    heading: EmailTypeStyle;
    body: EmailTypeStyle;
    small: EmailTypeStyle;
    eyebrow: EmailTypeStyle;
  };
  colors: {
    canvas: string;
    surface: string;
    ink: string;
    muted: string;
    brand: string;
    brandInk: string;
    link: string;
  };
  spacing: { small: number; medium: number; large: number; xl: number };
  radii: { image: number; button: number; card: number };
  button: { paddingX: number; paddingY: number; fontSize: number };
  image: { portraitWidth: number; squareWidth: number; landscapeWidth: number };
};

export const DEFAULT_EMAIL_TOKENS: EmailDesignTokens = {
  schemaVersion: 1,
  emailWidth: 600,
  contentWidth: 560,
  fonts: {
    heading: "Georgia, 'Times New Roman', Times, serif",
    body: "Georgia, 'Times New Roman', Times, serif",
    ui: "Arial, Helvetica, sans-serif",
  },
  type: {
    statement: { size: 40, lineHeight: 1.15, weight: 700 },
    title: { size: 32, lineHeight: 1.2, weight: 700 },
    heading: { size: 22, lineHeight: 1.3, weight: 700 },
    body: { size: 16, lineHeight: 1.5, weight: 400 },
    small: { size: 13, lineHeight: 1.5, weight: 400 },
    eyebrow: { size: 11, lineHeight: 1.4, weight: 700, tracking: 1.4 },
  },
  colors: {
    canvas: "#000000",
    surface: "#111111",
    ink: "#ffffff",
    muted: "#a1a1aa",
    brand: "#CFFF81",
    brandInk: "#000000",
    link: "#CFFF81",
  },
  spacing: { small: 16, medium: 32, large: 48, xl: 72 },
  radii: { image: 0, button: 999, card: 0 },
  button: { paddingX: 22, paddingY: 12, fontSize: 14 },
  image: { portraitWidth: 240, squareWidth: 320, landscapeWidth: 560 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function typeStyle(value: unknown, fallback: EmailTypeStyle): EmailTypeStyle {
  if (!isRecord(value)) return fallback;
  return {
    size: num(value.size, fallback.size),
    lineHeight: num(value.lineHeight, fallback.lineHeight),
    weight: num(value.weight, fallback.weight),
    tracking: value.tracking === undefined ? fallback.tracking : num(value.tracking, fallback.tracking ?? 0),
  };
}

/** Fill any missing token from the code default. Stored rows may predate later keys. */
export function resolveEmailTokens(raw: unknown): EmailDesignTokens {
  const base = DEFAULT_EMAIL_TOKENS;
  if (!isRecord(raw)) return base;
  const fonts = isRecord(raw.fonts) ? raw.fonts : {};
  const colors = isRecord(raw.colors) ? raw.colors : {};
  const spacing = isRecord(raw.spacing) ? raw.spacing : {};
  const radii = isRecord(raw.radii) ? raw.radii : {};
  const button = isRecord(raw.button) ? raw.button : {};
  const image = isRecord(raw.image) ? raw.image : {};
  const type = isRecord(raw.type) ? raw.type : {};
  return {
    schemaVersion: 1,
    emailWidth: num(raw.emailWidth, base.emailWidth),
    contentWidth: num(raw.contentWidth, base.contentWidth),
    fonts: {
      heading: str(fonts.heading, base.fonts.heading),
      body: str(fonts.body, base.fonts.body),
      ui: str(fonts.ui, base.fonts.ui),
    },
    type: {
      statement: typeStyle(type.statement, base.type.statement),
      title: typeStyle(type.title, base.type.title),
      heading: typeStyle(type.heading, base.type.heading),
      body: typeStyle(type.body, base.type.body),
      small: typeStyle(type.small, base.type.small),
      eyebrow: typeStyle(type.eyebrow, base.type.eyebrow),
    },
    colors: {
      canvas: str(colors.canvas, base.colors.canvas),
      surface: str(colors.surface, base.colors.surface),
      ink: str(colors.ink, base.colors.ink),
      muted: str(colors.muted, base.colors.muted),
      brand: str(colors.brand, base.colors.brand),
      brandInk: str(colors.brandInk, base.colors.brandInk),
      link: str(colors.link, base.colors.link),
    },
    spacing: {
      small: num(spacing.small, base.spacing.small),
      medium: num(spacing.medium, base.spacing.medium),
      large: num(spacing.large, base.spacing.large),
      xl: num(spacing.xl, base.spacing.xl),
    },
    radii: {
      image: num(radii.image, base.radii.image),
      button: num(radii.button, base.radii.button),
      card: num(radii.card, base.radii.card),
    },
    button: {
      paddingX: num(button.paddingX, base.button.paddingX),
      paddingY: num(button.paddingY, base.button.paddingY),
      fontSize: num(button.fontSize, base.button.fontSize),
    },
    image: {
      portraitWidth: num(image.portraitWidth, base.image.portraitWidth),
      squareWidth: num(image.squareWidth, base.image.squareWidth),
      landscapeWidth: num(image.landscapeWidth, base.image.landscapeWidth),
    },
  };
}

export function imageWidth(tokens: EmailDesignTokens, ratio: string): number {
  if (ratio === "portrait") return tokens.image.portraitWidth;
  if (ratio === "square") return tokens.image.squareWidth;
  return tokens.image.landscapeWidth;
}
