export const CONTENT_WIDTH_OPTIONS = [900, 1200, 1600] as const;

export type ContentWidth = typeof CONTENT_WIDTH_OPTIONS[number];

export const DEFAULT_CONTENT_WIDTH: ContentWidth = 900;
