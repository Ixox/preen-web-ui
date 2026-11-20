export interface VerticalDragParams {
  startValue: number;
  startY: number;
  currentY: number;
  min: number;
  max: number;
  dragRangePx: number;
  step?: number;
  fine?: boolean;
}

export function clampAndStep(raw: number, min: number, max: number, step?: number): number {
  const clamped = Math.max(min, Math.min(max, raw));
  if (step && step > 0) {
    return Math.max(min, Math.min(max, Math.round(clamped / step) * step));
  }
  return clamped;
}

export function valueFromVerticalDrag({
  startValue,
  startY,
  currentY,
  min,
  max,
  dragRangePx,
  step,
  fine = false,
}: VerticalDragParams): number {
  const dragRange = dragRangePx > 0 ? dragRangePx : 1;
  const sensitivity = fine ? 0.1 : 1;
  const deltaPx = startY - currentY;
  const raw = startValue + (deltaPx * (max - min)) / dragRange * sensitivity;
  return clampAndStep(raw, min, max, step);
}