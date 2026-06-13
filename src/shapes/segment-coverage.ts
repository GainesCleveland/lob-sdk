import { Point2 } from "@lob-sdk/vector";

/** A covered sub-range of a segment, as params [t0, t1] in 0..1 along it. */
export type Interval = [number, number];

/**
 * Sub-interval of segment p0->p1 (params 0..1) that lies within `radius` of the
 * circle centre, or null if it never gets that close. Bake any contact margin
 * into `radius`.
 */
export function segmentCircleCoverage(
  p0: Point2,
  p1: Point2,
  cx: number,
  cy: number,
  radius: number,
): Interval | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const lenSq = dx * dx + dy * dy;
  const rSq = radius * radius;

  if (lenSq === 0) {
    const ex = p0.x - cx;
    const ey = p0.y - cy;
    return ex * ex + ey * ey <= rSq ? [0, 0] : null;
  }

  const t = ((cx - p0.x) * dx + (cy - p0.y) * dy) / lenSq;
  const closestX = p0.x + t * dx;
  const closestY = p0.y + t * dy;
  const perpSq = (cx - closestX) ** 2 + (cy - closestY) ** 2;
  if (perpSq > rSq) return null;

  const half = Math.sqrt((rSq - perpSq) / lenSq); // half-chord in t units
  const t0 = Math.max(0, t - half);
  const t1 = Math.min(1, t + half);
  return t0 <= t1 ? [t0, t1] : null;
}

function signedArea(poly: Point2[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  return s / 2;
}

/**
 * Sub-interval of segment p0->p1 that lies inside the convex polygon (e.g. an
 * enemy OBB), via Cyrus-Beck clipping. null if the segment misses it. Winding
 * agnostic. Bake any contact margin into the polygon (expand it before calling).
 */
export function segmentConvexCoverage(
  p0: Point2,
  p1: Point2,
  poly: Point2[],
): Interval | null {
  if (poly.length < 3) return null;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const ccw = signedArea(poly) > 0;

  let tEnter = 0;
  let tLeave = 1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    // Inward normal of edge a->b.
    const nx = ccw ? -ey : ey;
    const ny = ccw ? ex : -ex;

    const num = (p0.x - a.x) * nx + (p0.y - a.y) * ny;
    const denom = dx * nx + dy * ny;
    if (denom === 0) {
      if (num < 0) return null; // parallel and entirely outside this edge
      continue;
    }
    const t = -num / denom;
    if (denom > 0) tEnter = Math.max(tEnter, t);
    else tLeave = Math.min(tLeave, t);
    if (tEnter > tLeave) return null;
  }
  return tEnter <= tLeave ? [tEnter, tLeave] : null;
}

/** Union of covered intervals, sorted and merged. Does not mutate inputs. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [s, e] = sorted[i];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

/** Total covered fraction (0..1) of a segment given its covered intervals. */
export function coveredFraction(intervals: Interval[]): number {
  let sum = 0;
  for (const [a, b] of mergeIntervals(intervals)) sum += b - a;
  return Math.min(sum, 1);
}

/** Free (uncovered) fraction (0..1): the part of the segment that can still fire. */
export function freeFraction(intervals: Interval[]): number {
  return 1 - coveredFraction(intervals);
}

/** Free (uncovered) sub-intervals of [0,1] (the gaps fire originates from). */
export function freeIntervals(intervals: Interval[]): Interval[] {
  const merged = mergeIntervals(intervals);
  const free: Interval[] = [];
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a > cursor) free.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < 1) free.push([cursor, 1]);
  return free;
}
