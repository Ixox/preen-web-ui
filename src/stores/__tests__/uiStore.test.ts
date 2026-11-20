import { describe, it, expect, beforeEach, vi } from 'vitest';

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
});

describe('uiStore knob drag mode', () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it('defaults to circular', async () => {
    const { useUIStore } = await import('../uiStore');
    expect(useUIStore.getState().knobDragMode).toBe('circular');
  });

  it('persists the selected mode', async () => {
    const { useUIStore } = await import('../uiStore');
    useUIStore.getState().setKnobDragMode('vertical');
    expect(useUIStore.getState().knobDragMode).toBe('vertical');
    expect(storage.get('preenFM3_knob_drag_mode')).toBe('vertical');
  });

  it('loads vertical from localStorage', async () => {
    storage.set('preenFM3_knob_drag_mode', 'vertical');
    const { useUIStore } = await import('../uiStore');
    expect(useUIStore.getState().knobDragMode).toBe('vertical');
  });
});

describe('uiStore font families', () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it('defaults to system global and mono digit', async () => {
    const { useUIStore } = await import('../uiStore');
    expect(useUIStore.getState().fontFamily).toBe('system');
    expect(useUIStore.getState().digitFontFamily).toBe('mono');
  });

  it('persists the selected font families', async () => {
    const { useUIStore } = await import('../uiStore');
    useUIStore.getState().setFontFamily('serif');
    useUIStore.getState().setDigitFontFamily('courier');
    expect(useUIStore.getState().fontFamily).toBe('serif');
    expect(useUIStore.getState().digitFontFamily).toBe('courier');
    expect(storage.get('preenFM3_font_family')).toBe('serif');
    expect(storage.get('preenFM3_digit_font_family')).toBe('courier');
  });

  it('loads font families from localStorage', async () => {
    storage.set('preenFM3_font_family', 'sans');
    storage.set('preenFM3_digit_font_family', 'consolas');
    const { useUIStore } = await import('../uiStore');
    expect(useUIStore.getState().fontFamily).toBe('sans');
    expect(useUIStore.getState().digitFontFamily).toBe('consolas');
  });

  it('falls back to defaults for unknown ids', async () => {
    storage.set('preenFM3_font_family', 'unknown');
    storage.set('preenFM3_digit_font_family', 'unknown');
    const { useUIStore } = await import('../uiStore');
    expect(useUIStore.getState().fontFamily).toBe('system');
    expect(useUIStore.getState().digitFontFamily).toBe('mono');
  });

  it('ignores invalid ids in setters', async () => {
    const { useUIStore } = await import('../uiStore');
    useUIStore.getState().setFontFamily('nope');
    useUIStore.getState().setDigitFontFamily('nope');
    expect(useUIStore.getState().fontFamily).toBe('system');
    expect(useUIStore.getState().digitFontFamily).toBe('mono');
  });
});