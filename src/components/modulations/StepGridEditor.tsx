import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

export interface StepModeVisualStyle {
  borderColor?: string;
  dashed?: boolean;
  fillBackground?: string;
  badgeBorderColor?: string;
  badgeBackground?: string;
  badgeTextColor?: string;
  optionTextColor?: string;
  /** Compact badge text (defaults to mode name, e.g. '-' for 'Norm') */
  badgeLabel?: string;
}

const StepsContainer = styled.div`
  margin-bottom: 12px;
  overflow-x: auto;
  user-select: none;
`;

const StepGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 4px;
  min-width: 440px;
`;

const StepColumn = styled.div<{ $isPastLoop?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  opacity: ${props => props.$isPastLoop ? 0.35 : 1};
  transition: opacity 0.2s ease;
`;

const StepValue = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 0.65rem;
  font-weight: bold;
  text-align: center;
  min-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const StepBar = styled.div<{
  $borderColor?: string;
  $dashed?: boolean;
  $editable: boolean;
}>`
  width: 100%;
  height: 120px;
  background: ${props => `linear-gradient(to bottom, ${props.theme.colors.primary}20 0%, ${props.theme.colors.primary}10 100%)`};
  border: 1px solid ${props => props.$borderColor || props.theme.colors.border};
  border-style: ${props => props.$dashed ? 'dashed' : 'solid'};
  border-radius: 4px;
  position: relative;
  cursor: ${props => props.$editable ? 'crosshair' : 'default'};
  transition: border-color 0.2s;

  &:hover {
    border-color: ${props => props.$editable ? props.theme.colors.primary : (props.$borderColor || props.theme.colors.border)};
  }
`;

const StepFill = styled.div<{ $value: number; $fillBackground?: string }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${props => props.$value}%;
  background: ${props =>
    props.$fillBackground ||
    `linear-gradient(to top, ${props.theme.colors.primary} 0%, ${props.theme.colors.accent} 100%)`};
  border-radius: 0 0 3px 3px;
  pointer-events: none;
  transition: height 0.05s ease-out;
`;

const StepLabel = styled.div`
  color: ${props => props.theme.colors.textMuted};
  font-size: 0.65rem;
  text-align: center;
`;

const StepModeBadge = styled.button<{
  $borderColor?: string;
  $background?: string;
  $color?: string;
  $readOnly?: boolean;
}>`
  width: 100%;
  padding: 2px 0;
  font-size: 0.6rem;
  font-weight: 600;
  line-height: 1;
  border-radius: 3px;
  border: 1px solid ${props => props.$borderColor || props.theme.colors.border};
  background: ${props => props.$background || props.theme.colors.button};
  color: ${props => props.$color || props.theme.colors.textMuted};
  cursor: ${props => props.$readOnly ? 'default' : 'pointer'};
  text-align: center;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    border-color: ${props => props.$readOnly ? (props.$borderColor || props.theme.colors.border) : props.theme.colors.primary};
    color: ${props => props.$readOnly ? (props.$color || props.theme.colors.textMuted) : props.theme.colors.primary};
  }
`;

const ModePopupContainer = styled.div<{ $top: number; $left: number; $openBelow: boolean }>`
  position: fixed;
  top: ${props => props.$top}px;
  left: ${props => props.$left}px;
  transform: ${props => props.$openBelow ? 'translateY(0)' : 'translateY(-100%)'};
  background: ${props => props.theme.colors.panel};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 2000;
  min-width: 148px;
  max-height: min(400px, calc(100vh - 16px));
  overflow-y: auto;
  white-space: nowrap;
`;

const ModeOptionButton = styled.button<{ $isSelected: boolean; $color?: string }>`
  background: ${props => props.$isSelected ? props.theme.colors.buttonActive : 'transparent'};
  border: none;
  border-radius: 4px;
  color: ${props => props.$color || props.theme.colors.text};
  font-size: 0.7rem;
  font-weight: 600;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  white-space: nowrap;

  &:hover {
    background: ${props => props.theme.colors.buttonHover};
    color: ${props => props.theme.colors.primary};
  }
`;

export interface StepGridEditorProps<M extends string> {
  steps: number[];
  modes: M[];
  availableModes: readonly M[];
  getModeLabel: (mode: M) => string;
  getModeStyle?: (mode: M) => StepModeVisualStyle;
  isStepEditable?: (mode: M) => boolean;
  readOnly?: boolean;
  activeLength?: number;
  resetKey?: string | number;
  quantizeValue?: (value: number) => number;
  onStepsChange?: (steps: number[]) => void;
  onModeChange?: (stepIndex: number, mode: M) => void;
}

export function StepGridEditor<M extends string>({
  steps,
  modes,
  availableModes,
  getModeLabel,
  getModeStyle,
  isStepEditable = () => true,
  readOnly = false,
  activeLength = 16,
  resetKey,
  quantizeValue,
  onStepsChange,
  onModeChange,
}: StepGridEditorProps<M>) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [localSteps, setLocalSteps] = useState<number[] | null>(null);
  const [openModeMenu, setOpenModeMenu] = useState<{
    index: number;
    top: number;
    left: number;
    openBelow: boolean;
  } | null>(null);

  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const displaySteps = localSteps || steps;

  useEffect(() => {
    setLocalSteps(null);
    setOpenModeMenu(null);
  }, [resetKey]);

  useEffect(() => {
    if (openModeMenu === null) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setOpenModeMenu(null);
      }
    };
    const handleScrollOrResize = () => setOpenModeMenu(null);
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openModeMenu]);

  const calculateValueFromMouseY = (e: React.MouseEvent<HTMLDivElement>, rect: DOMRect) => {
    const y = e.clientY - rect.top;
    const raw = Math.max(0, Math.min(100, Math.round(100 - (y / rect.height) * 100)));
    return quantizeValue ? quantizeValue(raw) : raw;
  };

  const findStepAndValue = (clientX: number, clientY: number): { index: number; value: number } | null => {
    if (!stepsContainerRef.current) return null;
    const bars = stepsContainerRef.current.querySelectorAll<HTMLElement>('[data-step-index]');
    if (bars.length === 0) return null;
    let closestIndex = -1;
    let minDist = Infinity;
    let closestRect: DOMRect | null = null;
    bars.forEach((bar) => {
      const rect = bar.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - centerX);
      if (dist < minDist) {
        minDist = dist;
        closestIndex = Number(bar.dataset.stepIndex);
        closestRect = rect;
      }
    });
    if (closestIndex < 0 || !closestRect) return null;
    const rect: DOMRect = closestRect;
    const raw = Math.max(0, Math.min(100, Math.round(100 - ((clientY - rect.top) / rect.height) * 100)));
    const value = quantizeValue ? quantizeValue(raw) : raw;
    return { index: closestIndex, value };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    setIsDrawing(true);
    const newSteps = [...steps];
    const hit = findStepAndValue(e.clientX, e.clientY);
    if (hit && isStepEditable(modes[hit.index])) {
      newSteps[hit.index] = hit.value;
    }
    setLocalSteps(newSteps);
  };

  const handleMouseUp = () => {
    if (readOnly) return;
    setIsDrawing(false);
    if (localSteps) {
      onStepsChange?.(localSteps);
      setLocalSteps(null);
    }
  };

  const handleStepClick = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isStepEditable(modes[index])) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const value = calculateValueFromMouseY(e, rect);
    const newSteps = [...steps];
    newSteps[index] = value;
    onStepsChange?.(newSteps);
  };

  useEffect(() => {
    if (!isDrawing || readOnly) return;
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const hit = findStepAndValue(e.clientX, e.clientY);
      if (!hit || !isStepEditable(modes[hit.index])) return;
      setLocalSteps((prev) => {
        const next = [...(prev || steps)];
        next[hit.index] = hit.value;
        return next;
      });
    };
    const handleGlobalMouseUp = () => {
      setIsDrawing(false);
      if (localSteps) {
        onStepsChange?.(localSteps);
        setLocalSteps(null);
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDrawing, readOnly, localSteps, steps, modes, onStepsChange]);

  return (
    <>
      <StepsContainer ref={stepsContainerRef} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
        <StepGrid>
          {displaySteps.map((value, index) => {
            const mode = modes[index] ?? availableModes[0];
            const style = getModeStyle?.(mode) ?? {};
            const isPastLoop = index >= activeLength;
            const showValue = isStepEditable(mode);
            const canEditBar = !readOnly && showValue;

            return (
              <StepColumn key={index} $isPastLoop={isPastLoop}>
                <StepValue>{showValue ? value : ''}</StepValue>
                <StepBar
                  data-step-index={index}
                  onClick={(e) => handleStepClick(index, e)}
                  title={showValue ? `Step ${index + 1}: ${value} (${mode})` : `Step ${index + 1}: ${mode}`}
                  $borderColor={style.borderColor}
                  $dashed={style.dashed}
                  $editable={canEditBar}
                >
                  {showValue && <StepFill $value={value} $fillBackground={style.fillBackground} />}
                </StepBar>
                <StepLabel>{index + 1}</StepLabel>
                <StepModeBadge
                  type="button"
                  $borderColor={style.badgeBorderColor}
                  $background={style.badgeBackground}
                  $color={style.badgeTextColor}
                  $readOnly={readOnly}
                  disabled={readOnly}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    if (openModeMenu?.index === index) {
                      setOpenModeMenu(null);
                      return;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const popupWidth = 156;
                    const openBelow = rect.top < 400;
                    const top = openBelow ? rect.bottom + 6 : rect.top - 6;
                    const rawLeft = rect.left + rect.width / 2 - popupWidth / 2;
                    const left = Math.max(8, Math.min(window.innerWidth - popupWidth - 8, rawLeft));
                    setOpenModeMenu({ index, top, left, openBelow });
                  }}
                  title={`Mode: ${getModeLabel(mode)}`}
                >
                  {style.badgeLabel ?? mode}
                </StepModeBadge>
              </StepColumn>
            );
          })}
        </StepGrid>
      </StepsContainer>

      {!readOnly && openModeMenu !== null && createPortal(
        <ModePopupContainer
          ref={modeMenuRef}
          $top={openModeMenu.top}
          $left={openModeMenu.left}
          $openBelow={openModeMenu.openBelow}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {availableModes.map((optMode) => {
            const currentMode = modes[openModeMenu.index] ?? availableModes[0];
            const optStyle = getModeStyle?.(optMode) ?? {};
            return (
              <ModeOptionButton
                key={optMode}
                type="button"
                $color={optStyle.optionTextColor}
                $isSelected={currentMode === optMode}
                onClick={() => {
                  onModeChange?.(openModeMenu.index, optMode);
                  setOpenModeMenu(null);
                }}
              >
                <span>{optMode}</span>
                <span style={{ fontSize: '0.6rem', opacity: 0.75 }}>
                  {getModeLabel(optMode)}
                </span>
              </ModeOptionButton>
            );
          })}
        </ModePopupContainer>,
        document.body
      )}
    </>
  );
}
