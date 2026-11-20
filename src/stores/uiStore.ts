import { create } from 'zustand';
import {
  CONTENT_WIDTH_OPTIONS,
  DEFAULT_CONTENT_WIDTH,
  type ContentWidth,
} from '../theme/layout';
import {
  DEFAULT_DIGIT_FONT_FAMILY,
  DEFAULT_FONT_FAMILY,
  DIGIT_FONT_OPTIONS,
  FONT_FAMILY_OPTIONS,
  applyFontVariables,
} from '../theme/fonts';

const LS_KEY = 'preenFM3_starfield_enabled';
const KNOB_MODE_LS_KEY = 'preenFM3_knob_drag_mode';
const CONTENT_WIDTH_LS_KEY = 'preenFM3_content_width';
const FONT_FAMILY_LS_KEY = 'preenFM3_font_family';
const DIGIT_FONT_FAMILY_LS_KEY = 'preenFM3_digit_font_family';

export type KnobDragMode = 'circular' | 'vertical';

function loadStarfield(): boolean {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function loadKnobDragMode(): KnobDragMode {
  try {
    return localStorage.getItem(KNOB_MODE_LS_KEY) === 'vertical' ? 'vertical' : 'circular';
  } catch {
    return 'circular';
  }
}

function loadContentWidth(): ContentWidth {
  try {
    const value = Number(localStorage.getItem(CONTENT_WIDTH_LS_KEY));
    return (CONTENT_WIDTH_OPTIONS as readonly number[]).includes(value)
      ? (value as ContentWidth)
      : DEFAULT_CONTENT_WIDTH;
  } catch {
    return DEFAULT_CONTENT_WIDTH;
  }
}

function loadFontFamily(): string {
  try {
    const value = localStorage.getItem(FONT_FAMILY_LS_KEY);
    return FONT_FAMILY_OPTIONS.some(option => option.id === value)
      ? value!
      : DEFAULT_FONT_FAMILY;
  } catch {
    return DEFAULT_FONT_FAMILY;
  }
}

function loadDigitFontFamily(): string {
  try {
    const value = localStorage.getItem(DIGIT_FONT_FAMILY_LS_KEY);
    return DIGIT_FONT_OPTIONS.some(option => option.id === value)
      ? value!
      : DEFAULT_DIGIT_FONT_FAMILY;
  } catch {
    return DEFAULT_DIGIT_FONT_FAMILY;
  }
}

interface UIStore {
  starfieldEnabled: boolean;
  toggleStarfield: () => void;
  knobDragMode: KnobDragMode;
  setKnobDragMode: (mode: KnobDragMode) => void;
  contentWidth: ContentWidth;
  setContentWidth: (width: ContentWidth) => void;
  fontFamily: string;
  setFontFamily: (id: string) => void;
  digitFontFamily: string;
  setDigitFontFamily: (id: string) => void;
  slowApiRequestCount: number;
  incrementSlowRequest: () => void;
  decrementSlowRequest: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  starfieldEnabled: loadStarfield(),
  toggleStarfield: () => {
    const next = !get().starfieldEnabled;
    try { localStorage.setItem(LS_KEY, String(next)); } catch { /* ignore */ }
    set({ starfieldEnabled: next });
  },
  knobDragMode: loadKnobDragMode(),
  setKnobDragMode: (mode) => {
    try { localStorage.setItem(KNOB_MODE_LS_KEY, mode); } catch { /* ignore */ }
    set({ knobDragMode: mode });
  },
  contentWidth: loadContentWidth(),
  setContentWidth: (width) => {
    try { localStorage.setItem(CONTENT_WIDTH_LS_KEY, String(width)); } catch { /* ignore */ }
    set({ contentWidth: width });
  },
  fontFamily: loadFontFamily(),
  setFontFamily: (id) => {
    if (!FONT_FAMILY_OPTIONS.some(option => option.id === id)) return;
    try { localStorage.setItem(FONT_FAMILY_LS_KEY, id); } catch { /* ignore */ }
    set({ fontFamily: id });
    applyFontVariables(id, get().digitFontFamily);
  },
  digitFontFamily: loadDigitFontFamily(),
  setDigitFontFamily: (id) => {
    if (!DIGIT_FONT_OPTIONS.some(option => option.id === id)) return;
    try { localStorage.setItem(DIGIT_FONT_FAMILY_LS_KEY, id); } catch { /* ignore */ }
    set({ digitFontFamily: id });
    applyFontVariables(get().fontFamily, id);
  },
  slowApiRequestCount: 0,
  incrementSlowRequest: () => set(s => ({ slowApiRequestCount: s.slowApiRequestCount + 1 })),
  decrementSlowRequest: () => set(s => ({ slowApiRequestCount: Math.max(0, s.slowApiRequestCount - 1) })),
}));

const initialUIState = useUIStore.getState();
applyFontVariables(initialUIState.fontFamily, initialUIState.digitFontFamily);