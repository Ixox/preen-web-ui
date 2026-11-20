import React, { useRef, useState } from "react";
import { useThemeStore } from '../../theme/themeStore';
import { useUIStore } from '../../stores/uiStore';
import { clampAndStep, valueFromVerticalDrag } from './knobDrag';

type ValuePosition = 'top' | 'bottom' | 'left' | 'none';
type LabelPosition = 'top' | 'left' | 'bottom' | 'none';

interface KnobBaseProps {
  size?: number;
  knobRadius?: number;
  min?: number;
  max?: number;
  value: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  step?: number; // pas optionnel : si défini -> mode discret, sinon continu
  color?: string;
  backgroundColor?: string;
  strokeColor?: string;
  strokeColorHover?: string;
  renderLabel?: (value: number) => React.ReactNode;
  label?: string | null;
  title?: string; // Tooltip HTML natif
  valuePosition?: ValuePosition; // Position d'affichage de la valeur
  labelPosition?: LabelPosition; // Position d'affichage du label
}

function KnobBase({
  size = 100,
  knobRadius = 20,
  min = 0,
  max = 100,
  value = 0,
  defaultValue,
  onChange = (arg) => { console.log("arg", arg) },
  step,
  color = "#000",
  backgroundColor = "#eee",
  strokeColor = "#ccc",
  renderLabel = (val: number) => val,
  label = null,
  title,
  valuePosition = 'bottom',
  labelPosition = 'top'
}: KnobBaseProps) {
  const { theme } = useThemeStore();
  const knobDragMode = useUIStore(state => state.knobDragMode);
  const center = size / 2;
  const radius = knobRadius ?? (center - 10);
  const isDragging = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const verticalDragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const lastPointerDownRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const START_ANGLE = -135;
  const END_ANGLE = 135;
  const ANGLE_RANGE = END_ANGLE - START_ANGLE;

  // Does the range span zero? If so, anchor 0 at 0° (12 o'clock)
  const crossesZero = min < 0 && max > 0;

  const angleForValue = (val: number) => {
    if (crossesZero) {
      // Piecewise: [min,0] → [START_ANGLE, 0°] and [0,max] → [0°, END_ANGLE]
      if (val <= 0) {
        const ratio = val / min; // 1 at min, 0 at zero
        return START_ANGLE * ratio;  // START_ANGLE when ratio=1, 0° when ratio=0
      } else {
        const ratio = val / max; // 0 at zero, 1 at max
        return END_ANGLE * ratio;    // 0° when ratio=0, END_ANGLE when ratio=1
      }
    }
    const ratio = (val - min) / (max - min);
    return START_ANGLE + ratio * ANGLE_RANGE;
  };

  const valueForAngle = (angle: number) => {
    const clamped = Math.max(START_ANGLE, Math.min(END_ANGLE, angle));
    if (crossesZero) {
      if (clamped <= 0) {
        // [START_ANGLE, 0°] → [min, 0]
        return min * (clamped / START_ANGLE);
      } else {
        // [0°, END_ANGLE] → [0, max]
        return max * (clamped / END_ANGLE);
      }
    }
    const ratio = (clamped - START_ANGLE) / ANGLE_RANGE;
    return min + ratio * (max - min);
  };

  const getAngleFromEvent = (e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return 0;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + center);
    const y = e.clientY - (rect.top + center);
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = angle + 90;
    if (angle < -180) angle += 360;
    if (angle > 180) angle -= 360;
    return angle;
  };

  const updateFromEvent = (e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return;
    const angle = getAngleFromEvent(e);
    const clampedAngle = Math.max(START_ANGLE, Math.min(END_ANGLE, angle));
    const rawValue = valueForAngle(clampedAngle);

    // Mode discret si un pas est défini, sinon continu
    onChange(clampAndStep(rawValue, min, max, step));
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return 0;

    const now = Date.now();
    const last = lastPointerDownRef.current;
    if (last && now - last.time < 350 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 8) {
      lastPointerDownRef.current = null;
      isDragging.current = false;
      e.preventDefault();
      const resetValue = defaultValue ?? (min <= 0 && max >= 0 ? 0 : min);
      onChange(resetValue);
      return;
    }
    lastPointerDownRef.current = { time: now, x: e.clientX, y: e.clientY };

    e.preventDefault();
    isDragging.current = true;

    if (knobDragMode === 'vertical') {
      verticalDragRef.current = { startY: e.clientY, startValue: value };
    } else {
      verticalDragRef.current = null;
      updateFromEvent(e);
    }

    // Capture: garantit la réception des pointermove/up pendant le drag
    try {
      (svgRef.current as unknown as SVGSVGElement).setPointerCapture(e.pointerId);
    } catch {
      // no-op (certains environnements peuvent ne pas supporter)
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !isDragging.current) return;
    e.preventDefault();

    if (knobDragMode === 'vertical' && verticalDragRef.current) {
      const { startY, startValue } = verticalDragRef.current;
      onChange(valueFromVerticalDrag({
        startValue,
        startY,
        currentY: e.clientY,
        min,
        max,
        dragRangePx: size,
        step,
        fine: e.shiftKey,
      }));
      return;
    }

    updateFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = false;
    verticalDragRef.current = null;
    try {
      (svgRef.current as unknown as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      // no-op
    }
  };

  const angle = angleForValue(value);
  const angleRad = (angle - 90) * (Math.PI / 180);
  const pointerRadius = radius -  2;
  const pointerX = center + pointerRadius * Math.cos(angleRad);
  const pointerY = center + pointerRadius * Math.sin(angleRad);

  const describeArc = (fromDeg: number, toDeg: number) => {
    const fromRad = (fromDeg - 90) * (Math.PI / 180);
    const toRad = (toDeg - 90) * (Math.PI / 180);
    const x1 = center + radius * Math.cos(fromRad);
    const y1 = center + radius * Math.sin(fromRad);
    const x2 = center + radius * Math.cos(toRad);
    const y2 = center + radius * Math.sin(toRad);
    const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    const sweep = toDeg >= fromDeg ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
  };

  const valueArcPath = describeArc(crossesZero ? 0 : START_ANGLE, angle);
  const trackArcPath = describeArc(START_ANGLE, END_ANGLE);
  const showValueArc = crossesZero ? Math.abs(angle) > 0.01 : angle > START_ANGLE + 0.01;

  // ── Editable value ──────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const startEditing = () => {
    setEditText(String(step && step >= 1 ? Math.round(value) : parseFloat(value.toFixed(4))));
    setIsEditing(true);
    // Focus will be set via autoFocus on the input
  };

  const commitEdit = () => {
    setIsEditing(false);
    const parsed = parseFloat(editText);
    if (isNaN(parsed)) return;
    let clamped = Math.max(min, Math.min(max, parsed));
    if (step && step > 0) {
      clamped = Math.round(clamped / step) * step;
    }
    onChange(clamped);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const editInputStyle: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: 3,
    color: color,
    fontSize: 12,
    fontFamily: 'var(--app-font-digit)',
    textAlign: 'center',
    outline: 'none',
    padding: '0 2px',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      title={title}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Label à gauche */}
      {labelPosition === 'left' && label && (
        <div
          className='label'
          style={{
            fontSize: 11,
            color: theme.colors.knobLabel,
            fontWeight: "bold",
            minWidth: '55px',
            textAlign: 'right',
            pointerEvents: "none",
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      )}

      {/* Valeur à gauche */}
      {valuePosition === 'left' && (
        <div
          style={{
            fontSize: 12,
            color: color,
            fontFamily: 'var(--app-font-digit)',
            minWidth: '45px',
            textAlign: 'right',
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
              autoFocus
              style={{ ...editInputStyle, textAlign: 'right', width: '45px' }}
            />
          ) : (
            <span
              onClick={startEditing}
              style={{ cursor: 'text', userSelect: 'none' }}
              title="Cliquer pour éditer"
            >
              {renderLabel(value)}
            </span>
          )}
        </div>
      )}

      {/* Colonne knob : label-top / value-top / SVG / value-bottom / label-bottom */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Label au-dessus */}
        {labelPosition === 'top' && label && (
          <div
            className='label'
            style={{
              width: size,
              textAlign: "center",
              fontSize: 12,
              fontWeight: "bold",
              pointerEvents: "none",
              color: theme.colors.knobLabel,
            }}
          >
            {label}
          </div>
        )}

        {/* Valeur au-dessus */}
        {valuePosition === 'top' && (
          <div
            className='label'
            style={{
              width: size,
              textAlign: "center",
              fontSize: 12,
              color: color,
              fontFamily: 'var(--app-font-digit)',
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                autoFocus
                style={editInputStyle}
              />
            ) : (
              <span
                onClick={startEditing}
                style={{ cursor: 'text', userSelect: 'none' }}
                title="Cliquer pour éditer"
              >
                {renderLabel(value)}
              </span>
            )}
          </div>
        )}

        {/* SVG du knob */}
        <div style={{ width: size, height: size }}>
          <svg
            ref={svgRef}
            width={size}
            height={size}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            style={{ userSelect: "none", cursor: knobDragMode === 'vertical' ? 'ns-resize' : 'pointer', touchAction: "none" }}
          >
            <circle
              cx={center}
              cy={center}
              r={radius * 1.2}
              fill="transparent"
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill={backgroundColor}
              style={{ filter: isHovered ? 'brightness(1.2)' : undefined }}
            />
            <path
              d={trackArcPath}
              fill="none"
              stroke={strokeColor}
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {showValueArc && (
              <path
                d={valueArcPath}
                fill="none"
                stroke={isHovered ? '#eee' : strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
            <line
              x1={center}
              y1={center}
              x2={pointerX}
              y2={pointerY}
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Valeur en dessous */}
        {valuePosition === 'bottom' && (
          <div
            className='label'
            style={{
              width: size,
              textAlign: "center",
              fontSize: 12,
              color: color,
              fontFamily: 'var(--app-font-digit)',
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                autoFocus
                style={editInputStyle}
              />
            ) : (
              <span
                onClick={startEditing}
                style={{ cursor: 'text', userSelect: 'none' }}
                title="Cliquer pour éditer"
              >
                {renderLabel(value)}
              </span>
            )}
          </div>
        )}

        {/* Label en dessous */}
        {labelPosition === 'bottom' && label && (
          <div
            className='label'
            style={{
              width: size,
              textAlign: "center",
              fontSize: 12,
              fontWeight: "bold",
              pointerEvents: "none",
              color: theme.colors.knobLabel,
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>

  );
}

export default React.memo(KnobBase);
