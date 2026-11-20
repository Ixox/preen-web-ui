import type { AlgoDiagram } from "./algorithms.static";
import type { HighlightedLink } from "../components/fmEngine/FMSynthContext";
import type { Theme } from "../theme/theme";

type RenderOptions = {
  cell?: number;
  margin?: number;
  highlightedLink?: HighlightedLink | null;
  highlightedNode?: number | null;
  theme?: Theme;
};

export function getAlgoCanvasColors(theme?: Theme): { background: string; grid: string } {
  const base = theme?.colors.background ?? "#0b1020";
  const isDark = base.length === 7
    ? parseInt(base.slice(1), 16) < 0x888888
    : true;
  return isDark
    ? { background: "#0f141c", grid: "rgba(203, 213, 225, 0.15)" }
    : { background: "#e8edf3", grid: "rgba(100, 116, 139, 0.25)" };
}

export function renderAlgoSvg(diagram: AlgoDiagram, opts: RenderOptions = {}): string {
  const baseCell = opts.cell ?? 48;
  const padding = 16;

  // Fixed grid: all algorithms share the same canvas, whatever their size.
  const GRID_COLS = 6;
  const GRID_ROWS = 4;
  const MAX_NODE_RADIUS = 16;
  const FEEDBACK_MARGIN = MAX_NODE_RADIUS / 2;

  const availW = (GRID_COLS - 1) * baseCell;
  const availH = (GRID_ROWS - 1) * baseCell;
  const width = availW + 2 * MAX_NODE_RADIUS + 2 * padding + FEEDBACK_MARGIN;
  const height = availH + 2 * MAX_NODE_RADIUS + 2 * padding + FEEDBACK_MARGIN;

  // Calculer les positions réelles min/max des nœuds
  const minX = Math.min(...diagram.nodes.map((n) => n.x));
  const maxX = Math.max(...diagram.nodes.map((n) => n.x));
  const minY = Math.min(...diagram.nodes.map((n) => n.y));
  const maxY = Math.max(...diagram.nodes.map((n) => n.y));

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  // Uniform cell adapted to the algorithm, so the diagram fills the fixed canvas.
  const cell = Math.min(
    cols > 1 ? availW / (cols - 1) : availW,
    rows > 1 ? availH / (rows - 1) : availH,
  );

  // Center the node grid in the fixed canvas.
  const offsetX = (width - (minX + maxX) * cell) / 2;
  const offsetY = (height - (minY + maxY) * cell) / 2;

  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));

  // Helper function to calculate IM index exactly like in ModulationIndexesEditor
  const calculateEdgeIMIndex = (fromOpId: string, toOpId: string): number => {
    const fromId = parseInt(fromOpId.replace(/\D/g, ''));
    const toId = parseInt(toOpId.replace(/\D/g, ''));
    
    // Use the same logic as ModulationIndexesEditor: iterate through edges in diagram order
    let idx = 0;
    for (const edge of diagram.edges) {
      const src = parseInt(edge.from.replace(/\D/g, ''));
      const tgt = parseInt(edge.to.replace(/\D/g, ''));
      const isFb = src === tgt;
      
      // If this is the edge we're looking for
      if (src === fromId && tgt === toId) {
        return isFb ? 5 : idx;
      }
      
      // Only increment for non-feedback edges
      if (!isFb) idx++;
    }
    
    return 0; // Fallback
  };

  const edges = diagram.edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;

    const x1 = offsetX + a.x * cell;
    const y1 = offsetY + a.y * cell;
    const x2 = offsetX + b.x * cell;
    const y2 = offsetY + b.y * cell;

    // Extraire les IDs numériques des opérateurs ("op1" -> 1)
    const sourceId = parseInt(e.from.replace(/\D/g, ''));
    const targetId = parseInt(e.to.replace(/\D/g, ''));

    // Déterminer la couleur de base selon le type de liaison
    let baseColor: string;
    if (e.kind === "sync") {
      // Synchronisation : rose/accent
      baseColor = opts.theme?.colors.accent || "#b910ab";
    } else {
      // Modulation : primary (vers CARRIER) ou variant plus clair (vers MODULATOR)
      baseColor = b.type === "CARRIER" ? (opts.theme?.colors.primary || "#0ea5e9") : "#7c3aed";
    }
    
    const imLabel = `IM${calculateEdgeIMIndex(e.from, e.to) + 1}`;
    
    // Cas spécial : feedback (self-loop) - 3/4 de cercle centré sur le coin haut-droit du nœud.
    // L'arc part du point droit du nœud et revient sur son point haut.
    if (e.from === e.to) {
      const nodeRadius = a.type === "CARRIER" ? 16 : 14;
      const loopRadius = nodeRadius;
      const loopCenterX = x1 + nodeRadius;
      const loopCenterY = y1 - nodeRadius;
      const startX = x1 + nodeRadius;
      const startY = y1;
      const endX = x1;
      const endY = y1 - nodeRadius;

      const arcPath = `M ${startX} ${startY} A ${loopRadius} ${loopRadius} 0 1 0 ${endX} ${endY}`;

      // Flèche à l'extrémité de l'arc, sur le haut du nœud (tangente verticale, vers le bas)
      const arrowPoints = `${endX},${endY} ${endX - 3},${endY - 6} ${endX + 3},${endY - 6}`;

      return `
        <g class="edge-group feedback" data-source="${sourceId}" data-target="${targetId}" data-base-color="${baseColor}">
          <path class="edge" d="${arcPath}" stroke="${baseColor}" stroke-width="2" fill="none" />
          <polygon class="edge-arrow" points="${arrowPoints}" fill="${baseColor}" />
          <text class="edge-label" x="${loopCenterX + 2}" y="${loopCenterY + 2}" text-anchor="middle" font-size="10" font-weight="bold" style="pointer-events: none;">Fbk</text>
        </g>
      `;
    }
    
    // Cas normal : ligne droite entre deux nœuds, avec une flèche au bout
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lineLength = Math.hypot(dx, dy) || 1;
    const ux = dx / lineLength;
    const uy = dy / lineLength;
    const sourceRadius = a.type === "CARRIER" ? 16 : 14;
    const targetRadius = b.type === "CARRIER" ? 16 : 14;
    const startX = x1 + ux * (sourceRadius + 1);
    const startY = y1 + uy * (sourceRadius + 1);
    const endX = x2 - ux * (targetRadius + 1);
    const endY = y2 - uy * (targetRadius + 1);

    const arrowLength = 6;
    const arrowHalfWidth = 3;
    const arrowBaseX = endX - ux * arrowLength;
    const arrowBaseY = endY - uy * arrowLength;
    const perpX = -uy;
    const perpY = ux;
    const arrowPoints = [
      `${endX},${endY}`,
      `${arrowBaseX + perpX * arrowHalfWidth},${arrowBaseY + perpY * arrowHalfWidth}`,
      `${arrowBaseX - perpX * arrowHalfWidth},${arrowBaseY - perpY * arrowHalfWidth}`,
    ].join(" ");

    let midX = (x1 + x2) / 2;
    let midY = (y1 + y2) / 2;
    
    // Vérifier si le label est trop proche d'un node et le décaler si nécessaire
    const minDistanceFromNode = 20; // Distance minimale d'un node
    for (const node of diagram.nodes) {
      const nodeX = offsetX + node.x * cell;
      const nodeY = offsetY + node.y * cell;
      const nodeRadius = node.type === "CARRIER" ? 16 : 14;
      const distanceToNode = Math.sqrt((midX - nodeX) ** 2 + (midY - nodeY) ** 2);
      
      if (distanceToNode < minDistanceFromNode + nodeRadius) {
        // Décaler le label perpendiculairement à la ligne
        const lineAngle = Math.atan2(y2 - y1, x2 - x1);
        const perpAngle = lineAngle + Math.PI / 2;
        const offsetDistance = 15;
        midX += Math.cos(perpAngle) * offsetDistance;
        midY += Math.sin(perpAngle) * offsetDistance;
        break;
      }
    }
    
    return `
      <g class="edge-group" data-source="${sourceId}" data-target="${targetId}" data-base-color="${baseColor}">
        <line class="edge" x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${baseColor}" stroke-width="2" />
        <polygon class="edge-arrow" points="${arrowPoints}" fill="${baseColor}" />
        <text class="edge-label" x="${midX}" y="${midY - 4}" text-anchor="middle" font-size="10" font-weight="bold" style="pointer-events: none;">${imLabel}</text>
      </g>
    `;
  });

  const highlightColor = opts.theme?.colors.highlight || "#fbbf24";

  const nodes = diagram.nodes.map((n, i) => {
    const cx = offsetX + n.x * cell;
    const cy = offsetY + n.y * cell;
    const isCarrier = n.type === "CARRIER";
    const nodeId = parseInt(n.id.replace(/\D/g, '')); // "op1" -> 1
    
    const radius = isCarrier ? 16 : 14;
    const fillColor = isCarrier ? "#75B798" : "#63B3ED";
    const strokeColor = opts.theme?.colors.border || "#2D3748";
    const textColor = "#1A202C"; // Texte sombre pour lisibilité sur les billes colorées

    return `
      <g id="node-${i}" class="node" data-node-id="${nodeId}">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1" />
        <circle class="node-ring" cx="${cx}" cy="${cy}" r="${radius + 3}" fill="none" stroke="${highlightColor}" stroke-width="2" />
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="${textColor}">${n.label}</text>
      </g>
    `;
  });

  const backgroundColor = opts.theme?.colors.background || "#0b1020";
  
  // Déterminer si on est en mode sombre ou clair
  const isDarkMode = backgroundColor.length === 7 ? 
    parseInt(backgroundColor.slice(1), 16) < 0x888888 : true;
  
  // Couleurs adaptées au thème
  const labelTextColor = isDarkMode ? "#e2e8f0" : "#2d3748";
  const labelShadowColor = isDarkMode ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)";
  const labelStrokeColor = isDarkMode ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.6)";

  const canvasColors = getAlgoCanvasColors(opts.theme);

  // Grid aligned on the node lattice: lines pass through node centers.
  const gridLines: string[] = [];
  const kMinX = Math.floor(-offsetX / cell);
  const kMaxX = Math.ceil((width - offsetX) / cell);
  for (let k = kMinX; k <= kMaxX; k++) {
    const x = offsetX + k * cell;
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${canvasColors.grid}" stroke-width="1" shape-rendering="crispEdges" />`);
  }
  const kMinY = Math.floor(-offsetY / cell);
  const kMaxY = Math.ceil((height - offsetY) / cell);
  for (let k = kMinY; k <= kMaxY; k++) {
    const y = offsetY + k * cell;
    gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${canvasColors.grid}" stroke-width="1" shape-rendering="crispEdges" />`);
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <!-- Filtres pour ombres -->
    <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="2" dy="3" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
    
    <style>
      .node circle {
        transition: stroke 0.5s ease, stroke-width 0.5s ease, filter 0.3s ease;
        filter: url(#dropShadow);
      }
      .node .node-ring {
        opacity: 0;
        filter: none;
        transition: opacity 0.15s ease;
      }
      .node-highlighted .node-ring {
        opacity: 1;
      }
      .edge {
        transition: stroke 0.5s ease, stroke-width 0.5s ease;
      }
      .edge-arrow {
        transition: fill 0.5s ease;
      }
      .edge-highlighted .edge {
        stroke: ${highlightColor} !important;
        stroke-width: 4;
        transition: stroke 0.03s ease, stroke-width 0.03s ease;
      }
      .edge-highlighted .edge-arrow {
        fill: ${highlightColor};
        transition: fill 0.03s ease;
      }
      .edge-label {
        transition: fill 1s ease;
        fill: ${labelTextColor};
        text-shadow: 0 1px 2px ${labelShadowColor};
        paint-order: stroke fill;
        stroke: ${labelStrokeColor};
        stroke-width: 1px;
        stroke-linejoin: round;
      }
      .edge-highlighted .edge-label {
        fill: ${highlightColor};
        transition: fill 0.03s ease;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
        stroke: rgba(0, 0, 0, 0.5);
      }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="${canvasColors.background}" />
  <g class="algo-grid">${gridLines.join("\n")}</g>
  ${edges.join("\n")}
  ${nodes.join("\n")}
</svg>`.trim();
}
