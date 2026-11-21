import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useOperatorEnvelope, updateADSR } from '../../../stores/patchStore';
import { type AdsrState } from '../../../types/adsr';
import { ADSR_CURVE_TYPES, type CurveType } from '../../../types/patch';
import { sendOperatorEnvCurve, sendOperatorADSR } from '../../../midi/midiService';
import { useThemeStore } from '../../../theme/themeStore';
import { generateCurvePoints, type CurvePoint as Point } from '../../../utils/envelopeCurve';

const AdsrContainer = styled.div`
  position: relative;
  width: 100%;
  box-sizing: border-box;
  background: ${props => props.theme.colors.background};
  margin-top: 4px;
  margin-bottom: 4px;
  border-radius: 4px;
`;

const StyledSvg = styled.svg`
  display: block;
  width: 100%;
  height: 160px;
  padding: 2px;
  user-select: none;
`;

const Tooltip = styled.div`
  position: absolute;
  transform: translate(30px, -30px);
  background: ${props => props.theme.colors.panel};
  color: ${props => props.theme.colors.text};
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  box-shadow: 0 2px 8px ${props => props.theme.colors.border};
`;

const EditorOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const EditorPanel = styled.div`
  min-width: 250px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.panel};
  color: ${props => props.theme.colors.text};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
`;

const EditorTitle = styled.div`
  margin-bottom: 12px;
  font-weight: 600;
  text-transform: capitalize;
`;

const EditorRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 13px;
`;

const EditorInput = styled.input`
  width: 90px;
  padding: 5px 7px;
  border-radius: 4px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-family: var(--app-font-digit);
`;

const EditorButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
`;

const EditorButton = styled.button<{ $primary?: boolean }>`
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid ${props => props.$primary ? props.theme.colors.primary : props.theme.colors.border};
  background: ${props => props.$primary ? props.theme.colors.primary : props.theme.colors.button};
  color: ${props => props.$primary ? '#fff' : props.theme.colors.text};
  cursor: pointer;
  font-size: 13px;

  &:hover {
    background: ${props => props.$primary ? props.theme.colors.primary : props.theme.colors.buttonHover};
  }
`;

interface AdsrControlProps {
  operatorId: number;
}

const AdsrControl: React.FC<AdsrControlProps> = ({ operatorId }) => {

  const envelope = useOperatorEnvelope(operatorId);
  const { theme } = useThemeStore();

  if (!envelope) return null;

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragInfo, setDragInfo] = useState<{ key: string; time: number; level: number } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ key: string; time: number; level: number } | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<null | 'attack' | 'decay' | 'sustain' | 'release'>(null);
  const [pointEditor, setPointEditor] = useState<{ key: 'attack' | 'decay' | 'sustain' | 'release'; time: string; level: string } | null>(null);
  const maxSegmentSize = 16; // Limite fixe de 16 pour chaque segment
  const margin = { top: 6, right: 6, bottom: 16, left: 6 };
  const height = 160 - margin.top - margin.bottom;
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(254 - margin.left - margin.right);
  const width = plotWidth;

  // Références pour les éléments D3
  const circlesRef = useRef<{ [key: string]: d3.Selection<SVGCircleElement, Point, null, undefined> }>({});
  const dragRingRef = useRef<d3.Selection<SVGCircleElement, unknown, null, undefined> | null>(null);
  const hoverRingRef = useRef<d3.Selection<SVGCircleElement, unknown, null, undefined> | null>(null);
  const segmentPathsRef = useRef<Array<d3.Selection<SVGPathElement, Point[], null, undefined>>>([]);
  const segmentHitPathsRef = useRef<Array<d3.Selection<SVGPathElement, Point[], null, undefined>>>([]);

  // Stocke les positions actuelles avec leur contrainte
  const currentPoints = useRef<Point[]>([]);
  const dragOffset = useRef<{ x: number, y: number } | null>(null);
  const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
  const yScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);

  // Couleurs distinctes pour chaque point (depuis le thème)
  const pointColors = {
    attack: theme.colors.adsrAttack,
    decay: theme.colors.adsrDecay,
    sustain: theme.colors.adsrSustain,
    release: theme.colors.adsrRelease
  };

  // Génère les points pour chaque segment (pour interaction)
  const getSegmentPoints = (points: Point[]) => ([
    generateCurvePoints(points[0], points[1], envelope.curves?.attack || 'linear'),
    generateCurvePoints(points[1], points[2], envelope.curves?.decay || 'exponential'),
    generateCurvePoints(points[2], points[3], envelope.curves?.sustain || 'linear'),
    generateCurvePoints(points[3], points[4], envelope.curves?.release || 'exponential'),
  ]);

  // Initialise et met à jour les points  
  useEffect(() => {
    currentPoints.current = [
      { x: 0, y: 0 },
      { x: envelope.attack.time, y: envelope.attack.level },
      { x: envelope.decay.time, y: envelope.decay.level },
      { x: envelope.sustain.time, y: envelope.sustain.level },
      { x: envelope.release.time, y: envelope.release.level }
    ];
  }, [envelope]);

  // Ajuste la largeur du tracé à celle du conteneur (hauteur fixe)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setPlotWidth(Math.max(0, el.clientWidth - margin.left - margin.right));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [margin.left, margin.right]);

  // Gestion du rendu D3
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr('preserveAspectRatio', 'none')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // L'échelle X s'adapte à la durée réelle de l'enveloppe
    // Logique adaptative pour les enveloppes courtes vs longues
    const actualMaxTime = envelope.release.time;
    let maxTime;
    if (actualMaxTime < 1) {
      // Pour les enveloppes très courtes, utilise la durée réelle + petite marge pour s'étendre sur toute la largeur
      maxTime = Math.max(actualMaxTime * 1.15, 0.1);
    } else if (actualMaxTime < 4) {
      // Pour les enveloppes moyennes, utilise la durée réelle + marge modérée
      maxTime = actualMaxTime * 1.15;
    } else {
      // Pour les enveloppes longues, utilise la logique d'origine avec marge fixe
      maxTime = Math.max(actualMaxTime * 1.15, actualMaxTime + 2, 1);
    }
    // Déplacer xScale/yScale dans le scope du composant pour accès dans le handler drag
    const xScale = d3.scaleLinear().domain([0, maxTime]).range([0, width]);
    const yScale = d3.scaleLinear().domain([100, 0]).range([0, height]);
    xScaleRef.current = xScale;
    yScaleRef.current = yScale;
    // Stocker les scales dans des refs pour accès stable dans le handler drag
    (AdsrControl as any)._xScale = xScale;
    (AdsrControl as any)._yScale = yScale;

    // Quadrillage adaptatif pour l'axe Y (levels)
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(() => ''))
      .selectAll('.tick line')
      .attr('stroke', theme.colors.border)
      .attr('stroke-dasharray', '2,2');

    // Quadrillage adaptatif : moins de lignes pour les enveloppes courtes
    const numTicks = maxTime < 1 
      ? Math.max(1, Math.ceil(maxTime * 2)) // Max 2 ticks pour enveloppes < 1s
      : Math.ceil(maxTime); // 1 tick par seconde pour les longues
    const tickStep = maxTime > 20 ? 5 : maxTime > 10 ? 2 : null;
    const tickValues = tickStep ? d3.range(0, maxTime + 1e-9, tickStep) : null;
    const xAxis = g.append('g')
      .attr('class', 'grid x-grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        tickValues
          ? d3.axisBottom(xScale).tickValues(tickValues).tickSize(-height).tickFormat(null)
          : d3.axisBottom(xScale).ticks(numTicks).tickSize(-height).tickFormat(null)
      );
    xAxis.selectAll('.tick line')
      .attr('stroke', theme.colors.border)
      .attr('stroke-dasharray', '2,2');
    xAxis.selectAll('.tick text')
      .attr('transform', 'translate(0,4)');

    const lineGenerator = d3.line<Point>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y));


    // Dessin de chaque segment séparément pour interaction
    const segmentKeys: Array<'attack' | 'decay' | 'sustain' | 'release'> = ['attack', 'decay', 'sustain', 'release'];
    const segmentColors = [theme.colors.adsrAttack, theme.colors.adsrDecay, theme.colors.adsrSustain, theme.colors.adsrRelease];
    const segmentPoints = getSegmentPoints(currentPoints.current);
    segmentPathsRef.current = [];
    segmentHitPathsRef.current = [];
    segmentPoints.forEach((seg, i) => {
      // Large hit area (invisible)
      segmentHitPathsRef.current[i] = g.append('path')
        .datum(seg)
        .attr('d', lineGenerator)
        .attr('stroke', 'transparent')
        .attr('stroke-width', 18)
        .attr('fill', 'none')
        .attr('cursor', 'pointer')
        .attr('data-segment', segmentKeys[i])
        .on('click', () => setSelectedSegment(segmentKeys[i]));

      // Visible segment line (as avant)
      segmentPathsRef.current[i] = g.append('path')
        .datum(seg)
        .attr('d', lineGenerator)
        .attr('stroke', selectedSegment === segmentKeys[i] ? theme.colors.accent : segmentColors[i])
        .attr('stroke-width', selectedSegment === segmentKeys[i] ? 4 : 2)
        .attr('fill', 'none')
        .attr('pointer-events', 'none'); // Ignore events, only the hit area above is interactive
    });

    // Gestion du drag
    let lastMidiSend = 0;
    const dragHandler = d3.drag<SVGCircleElement, Point, Point>()









      .on('start', function (event) {
        const key = d3.select(this).attr('data-key');
        setDragging(key);
        setHoverInfo(null); // Cacher le tooltip hover pendant le drag

        const pointIndex = ['attack', 'decay', 'sustain', 'release'].indexOf(key) + 1;
        const point = currentPoints.current[pointIndex];
        const mouseX = xScale.invert(event.x);
        const mouseY = yScale.invert(event.y);
        dragOffset.current = {
          x: mouseX - point.x,
          y: mouseY - point.y
        };

        setDragInfo({ key, time: point.x, level: point.y });
        const circle = d3.select(this);
        hoverRingRef.current?.attr('opacity', 0);
        dragRingRef.current
          ?.attr('cx', parseFloat(circle.attr('cx')))
          .attr('cy', parseFloat(circle.attr('cy')))
          .attr('opacity', 1);
      })
      .on('drag', function (event) {
        const key = d3.select(this).attr('data-key');
        if (!dragOffset.current) return;
        const pointIndex = ['attack', 'decay', 'sustain', 'release'].indexOf(key) + 1;

        let newX = xScale.invert(event.x) - dragOffset.current.x;
        const newY = yScale.invert(event.y) - dragOffset.current.y;

        // Application des contraintes avec possibilité de pousser les points suivants
        // maxSegmentSize est fixé à 16 pour tous les segments
        const [, a, d, s, r] = currentPoints.current;

        // Contraindre la nouvelle position
        newX = Math.max(0, newX);
        const constrainedY = Math.max(0, Math.min(100, newY));

        // Logique de poussée des points suivants en cascade
        switch (key) {
          case 'attack': {
            let constrainedX = Math.min(newX, maxSegmentSize);
            if (constrainedX > d.x) {
              currentPoints.current[2].x = constrainedX;
              if (currentPoints.current[2].x > s.x) {
                currentPoints.current[3].x = currentPoints.current[2].x;
                if (currentPoints.current[3].x > r.x) {
                  currentPoints.current[4].x = currentPoints.current[3].x;
                }
              }
            }
            currentPoints.current[1] = { x: constrainedX, y: constrainedY };
            setDragInfo({ key, time: constrainedX, level: constrainedY });
            break;
          }
          case 'decay': {
            let constrainedX = Math.max(a.x, Math.min(newX, a.x + maxSegmentSize));
            if (constrainedX > s.x) {
              currentPoints.current[3].x = constrainedX;
              if (currentPoints.current[3].x > r.x) {
                currentPoints.current[4].x = currentPoints.current[3].x;
              }
            }
            currentPoints.current[2] = { x: constrainedX, y: constrainedY };
            setDragInfo({ key, time: constrainedX, level: constrainedY });
            break;
          }
          case 'sustain': {
            let constrainedX = Math.max(d.x, Math.min(newX, d.x + maxSegmentSize));
            if (constrainedX > r.x) {
              currentPoints.current[4].x = constrainedX;
            }
            currentPoints.current[3] = { x: constrainedX, y: constrainedY };
            setDragInfo({ key, time: constrainedX, level: constrainedY });
            break;
          }
          case 'release': {
            const constrainedX = Math.max(s.x, Math.min(newX, s.x + maxSegmentSize));
            currentPoints.current[4] = { x: constrainedX, y: constrainedY };
            setDragInfo({ key, time: constrainedX, level: constrainedY });
            break;
          }
        }

        // Mise à jour visuelle de tous les points
        ['attack', 'decay', 'sustain', 'release'].forEach((k, idx) => {
          const pt = currentPoints.current[idx + 1];
          circlesRef.current[k]
            ?.attr('cx', xScale(pt.x))
            .attr('cy', yScale(pt.y));
        });

        // Redessine les segments pendant le drag
        const liveSegments = getSegmentPoints(currentPoints.current);
        liveSegments.forEach((segment, index) => {
          const path = lineGenerator(segment);
          segmentPathsRef.current[index]?.attr('d', path);
          segmentHitPathsRef.current[index]?.attr('d', path);
        });

        const dragged = currentPoints.current[pointIndex];
        dragRingRef.current
          ?.attr('cx', xScale(dragged.x))
          .attr('cy', yScale(dragged.y));

        // Live MIDI updates while dragging (coalesced by the MIDI queue).
        const now = performance.now();
        if (now - lastMidiSend >= 50) {
          lastMidiSend = now;
          sendOperatorADSR(operatorId, {
            attack: { time: currentPoints.current[1].x, level: currentPoints.current[1].y },
            decay: { time: currentPoints.current[2].x, level: currentPoints.current[2].y },
            sustain: { time: currentPoints.current[3].x, level: currentPoints.current[3].y },
            release: { time: currentPoints.current[4].x, level: currentPoints.current[4].y },
          });
        }

      })
      .on('end', function () {
        setDragging(null);
        setDragInfo(null);
        dragOffset.current = null;
        const circle = d3.select(this);
        dragRingRef.current?.attr('opacity', 0);
        hoverRingRef.current
          ?.attr('cx', circle.attr('cx'))
          .attr('cy', circle.attr('cy'))
          .attr('opacity', 1);

        // Sauvegarder le point modifié
        const updates: Partial<AdsrState> = {
          attack: { time: currentPoints.current[1].x, level: currentPoints.current[1].y },
          decay: { time: currentPoints.current[2].x, level: currentPoints.current[2].y },
          sustain: { time: currentPoints.current[3].x, level: currentPoints.current[3].y },
          release: { time: currentPoints.current[4].x, level: currentPoints.current[4].y }
        };
        requestAnimationFrame(() => {
          updateADSR(operatorId, updates);
        });
      });

    // Création des points interactifs
    hoverRingRef.current = g.append('circle')
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', theme.colors.textMuted)
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    dragRingRef.current = g.append('circle')
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    circlesRef.current = {};
    ['attack', 'decay', 'sustain', 'release'].forEach((key, i) => {
      circlesRef.current[key] = g.append('circle')
        .datum(currentPoints.current[i + 1])
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 6)
        .attr('fill', pointColors[key as keyof typeof pointColors])
        .attr('stroke', theme.colors.background)
        .attr('stroke-width', 2)
        .attr('cursor', 'pointer')
        .attr('data-key', key)
        .on('mouseover', function() {
          const point = currentPoints.current[i + 1];
          setHoverInfo({ key, time: point.x, level: point.y });
          if (!dragOffset.current) {
            const circle = d3.select(this);
            hoverRingRef.current
              ?.attr('cx', circle.attr('cx'))
              .attr('cy', circle.attr('cy'))
              .attr('opacity', 1);
          }
        })
        .on('mouseout', function() {
          hoverRingRef.current?.attr('opacity', 0);
          if (!dragOffset.current) {
            setHoverInfo(null);
          }
        })
        .on('dblclick', function(event) {
          event.preventDefault();
          const point = currentPoints.current[i + 1];
          setPointEditor({ key: key as 'attack' | 'decay' | 'sustain' | 'release', time: point.x.toFixed(2), level: String(Math.round(point.y)) });
        })
        .call(dragHandler);
    });

  }, [envelope, theme, width]); // Rafraîchir quand l'enveloppe, le thème ou la largeur change

  // Détermine si on doit afficher le tooltip (drag ou hover)
  const infoToShow = dragInfo || hoverInfo;
  // Affiche le menu de sélection de courbe si un segment est sélectionné

  const handleCurveChange = (curve: CurveType) => {
    if (!selectedSegment) return;
    // Toujours fournir un objet complet pour curves
    const prev = envelope.curves ?? {
      attack: 'linear',
      decay: 'exponential',
      sustain: 'linear',
      release: 'exponential',
    };
    updateADSR(operatorId, {
      curves: {
        attack: selectedSegment === 'attack' ? curve : prev.attack,
        decay: selectedSegment === 'decay' ? curve : prev.decay,
        sustain: selectedSegment === 'sustain' ? curve : prev.sustain,
        release: selectedSegment === 'release' ? curve : prev.release,
      }
    });
    sendOperatorEnvCurve(operatorId, selectedSegment, curve);
    setSelectedSegment(null);
  };

  const applyPointEditor = () => {
    if (!pointEditor) return;
    const key = pointEditor.key;
    const pointIndex = ['attack', 'decay', 'sustain', 'release'].indexOf(key) + 1;
    let time = parseFloat(pointEditor.time);
    let level = parseFloat(pointEditor.level);
    if (!Number.isFinite(time)) time = currentPoints.current[pointIndex].x;
    if (!Number.isFinite(level)) level = currentPoints.current[pointIndex].y;
    level = Math.max(0, Math.min(100, level));

    const [, a, d, s, r] = currentPoints.current;
    let constrainedX = time;
    switch (key) {
      case 'attack':
        constrainedX = Math.max(0, Math.min(time, maxSegmentSize));
        if (constrainedX > d.x) {
          currentPoints.current[2].x = constrainedX;
          if (currentPoints.current[2].x > s.x) {
            currentPoints.current[3].x = currentPoints.current[2].x;
            if (currentPoints.current[3].x > r.x) {
              currentPoints.current[4].x = currentPoints.current[3].x;
            }
          }
        }
        break;
      case 'decay':
        constrainedX = Math.max(a.x, Math.min(time, a.x + maxSegmentSize));
        if (constrainedX > s.x) {
          currentPoints.current[3].x = constrainedX;
          if (currentPoints.current[3].x > r.x) {
            currentPoints.current[4].x = currentPoints.current[3].x;
          }
        }
        break;
      case 'sustain':
        constrainedX = Math.max(d.x, Math.min(time, d.x + maxSegmentSize));
        if (constrainedX > r.x) {
          currentPoints.current[4].x = constrainedX;
        }
        break;
      case 'release':
        constrainedX = Math.max(s.x, Math.min(time, s.x + maxSegmentSize));
        break;
    }
    currentPoints.current[pointIndex] = { x: constrainedX, y: level };

    const xs = xScaleRef.current;
    const ys = yScaleRef.current;
    if (xs && ys) {
      ['attack', 'decay', 'sustain', 'release'].forEach((k, idx) => {
        const pt = currentPoints.current[idx + 1];
        circlesRef.current[k]?.attr('cx', xs(pt.x)).attr('cy', ys(pt.y));
      });
      const lineGen = d3.line<Point>().x(pt => xs(pt.x)).y(pt => ys(pt.y));
      getSegmentPoints(currentPoints.current).forEach((segment, index) => {
        const path = lineGen(segment) ?? '';
        segmentPathsRef.current[index]?.attr('d', path);
        segmentHitPathsRef.current[index]?.attr('d', path);
      });
    }

    updateADSR(operatorId, {
      attack: { time: currentPoints.current[1].x, level: currentPoints.current[1].y },
      decay: { time: currentPoints.current[2].x, level: currentPoints.current[2].y },
      sustain: { time: currentPoints.current[3].x, level: currentPoints.current[3].y },
      release: { time: currentPoints.current[4].x, level: currentPoints.current[4].y }
    });
    setPointEditor(null);
  };

  const portalTarget = containerRef.current?.parentElement ?? null;

  return (
    <AdsrContainer ref={containerRef}>
      <StyledSvg ref={svgRef} />
      {/* Tooltip affiché au même endroit pour drag et hover */}
      {infoToShow && (
        <Tooltip style={{
          top: '-1px',
          left: '-25px'
        }}>
          {dragging ? 'Editing' : 'Point'}: {infoToShow.key} |
          Time: {infoToShow.time.toFixed(2)} |
          Level: {Math.round(infoToShow.level)}%
        </Tooltip>
      )}
      {/* Menu de sélection de courbe d'enveloppe */}
      {selectedSegment && (
        <Tooltip style={{ top: '40px', left: '10px', zIndex: 10 }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>
            {selectedSegment.charAt(0).toUpperCase() + selectedSegment.slice(1)} curve
          </div>
          {ADSR_CURVE_TYPES.map(type => (
            <div key={type} style={{
              padding: '2px 8px',
              margin: '2px 0',
              borderRadius: 3,
              background: envelope.curves?.[selectedSegment] === type ? theme.colors.accent : 'transparent',
              color: envelope.curves?.[selectedSegment] === type ? theme.colors.background : theme.colors.text,
              cursor: 'pointer',
              fontWeight: envelope.curves?.[selectedSegment] === type ? 700 : 400
            }}
              onClick={() => handleCurveChange(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setSelectedSegment(null)} style={{ fontSize: 12 }}>Annuler</button>
          </div>
        </Tooltip>
      )}

      {pointEditor && portalTarget && createPortal(
        <EditorOverlay onClick={() => setPointEditor(null)}>
          <EditorPanel
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPointEditor(null);
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyPointEditor();
              }}
            >
              <EditorTitle>Edit {pointEditor.key}</EditorTitle>
              <EditorRow>
                Time
                <EditorInput
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={pointEditor.time}
                  onChange={(e) => setPointEditor({ ...pointEditor, time: e.target.value })}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </EditorRow>
              <EditorRow>
                Level
                <EditorInput
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={pointEditor.level}
                  onChange={(e) => setPointEditor({ ...pointEditor, level: e.target.value })}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </EditorRow>
              <EditorButtons>
                <EditorButton type="button" onClick={() => setPointEditor(null)}>
                  Cancel
                </EditorButton>
                <EditorButton type="submit" $primary>
                  Confirm
                </EditorButton>
              </EditorButtons>
            </form>
          </EditorPanel>
        </EditorOverlay>,
        portalTarget,
      )}
    </AdsrContainer>
  );
}

export default React.memo(AdsrControl);