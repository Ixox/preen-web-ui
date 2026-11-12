import { type CurveType } from '../types/patch';

export type CurvePoint = { x: number; y: number };

/**
 * Generates intermediate points along a curve between `start` and `end`
 * matching the PreenFM envelope curve shapes.
 */
export function generateCurvePoints(
  start: CurvePoint,
  end: CurvePoint,
  curveType: CurveType = 'linear',
  numPoints = 20
): CurvePoint[] {
  const points: CurvePoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    let factor: number;

    switch (curveType) {
      // Inverser la logique pour correspondre au PreenFM :
      case 'exponential':
        // PreenFM: exponentielle = montée rapide puis plateau
        factor = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        break;
      case 'logarithmic':
        // PreenFM: logarithmique = montée lente puis rapide
        factor = t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
        break;
      case 'user1':
      case 'user2':
      case 'user3':
      case 'user4':
        // Courbes utilisateur personnalisées
        factor = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        break;
      default: // 'linear'
        factor = t;
    }

    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * factor,
    });
  }

  return points;
}
