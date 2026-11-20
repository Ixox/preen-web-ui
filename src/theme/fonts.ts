export interface FontOption {
  id: string;
  labelKey: string;
  stack: string;
}

const SYSTEM_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

const MONO_STACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace";

export const FONT_FAMILY_OPTIONS: FontOption[] = [
  { id: 'system', labelKey: 'fonts.system', stack: SYSTEM_STACK },
  { id: 'systemUi', labelKey: 'fonts.systemUi', stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: 'sans', labelKey: 'fonts.sans', stack: "Arial, Helvetica, 'Helvetica Neue', sans-serif" },
  { id: 'serif', labelKey: 'fonts.serif', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'mono', labelKey: 'fonts.mono', stack: MONO_STACK },
  { id: 'verdana', labelKey: 'fonts.verdana', stack: "Verdana, Geneva, 'DejaVu Sans', sans-serif" },
  { id: 'trebuchet', labelKey: 'fonts.trebuchet', stack: "'Trebuchet MS', 'Lucida Grande', 'DejaVu Sans', sans-serif" },
  { id: 'palatino', labelKey: 'fonts.palatino', stack: "'Palatino Linotype', 'Book Antiqua', Palatino, 'URW Palladio L', serif" },
];

export const DIGIT_FONT_OPTIONS: FontOption[] = [
  { id: 'mono', labelKey: 'fonts.mono', stack: MONO_STACK },
  { id: 'courier', labelKey: 'fonts.courier', stack: "'Courier New', Courier, monospace" },
  { id: 'consolas', labelKey: 'fonts.consolas', stack: "Consolas, Menlo, Monaco, 'Liberation Mono', monospace" },
  { id: 'system', labelKey: 'fonts.system', stack: SYSTEM_STACK },
  { id: 'menlo', labelKey: 'fonts.menlo', stack: "Menlo, Monaco, Consolas, 'Liberation Mono', monospace" },
  { id: 'lucida', labelKey: 'fonts.lucida', stack: "'Lucida Console', Monaco, 'DejaVu Sans Mono', monospace" },
];

export const DEFAULT_FONT_FAMILY = 'system';
export const DEFAULT_DIGIT_FONT_FAMILY = 'mono';

function stackFor(options: FontOption[], id: string, fallbackId: string): string {
  return (
    options.find(option => option.id === id) ??
    options.find(option => option.id === fallbackId) ??
    options[0]
  ).stack;
}

export function applyFontVariables(fontId: string, digitId: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--app-font-family', stackFor(FONT_FAMILY_OPTIONS, fontId, DEFAULT_FONT_FAMILY));
  root.style.setProperty('--app-font-digit', stackFor(DIGIT_FONT_OPTIONS, digitId, DEFAULT_DIGIT_FONT_FAMILY));
}
