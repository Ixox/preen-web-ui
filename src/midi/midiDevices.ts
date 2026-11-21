export const PREENFM3_MIDI_NAME = 'PreenFM3';

export function isPreenFM3Device(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (lower.includes('web editor')) return false;
  return lower.startsWith('preenfm3');
}
