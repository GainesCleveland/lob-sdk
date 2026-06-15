import { Point2 } from "@lob-sdk/vector";
import { ShapeType } from "./types";
import { convexOverlapRatio } from "./polygon/utils";
import { Circle } from "./circle";

/**
 * A unit's collision footprint as a single convex primitive. Two implementations,
 * `ObbShape` (a rotated rectangle, napoleonic) and `Circle` (WW2), share this
 * interface so collision consumers stay shape-agnostic. The binary `overlapRatio`
 * is resolved by pair-dispatch on the concrete type (the classic double-dispatch
 * case); every other op is unary. Adding a new shape = a new class plus its overlap
 * cases. A circle stays a true circle (centre + radius), never a polygon.
 */
export interface CollisionShape {
  readonly shapeType: ShapeType;
  readonly center: Point2;
  /** Distance from the centre to the farthest point of the footprint. */
  boundingRadius(): number;
  /** Overlap as a fraction (0..1) of the smaller footprint's area; 0 = disjoint. */
  overlapRatio(other: CollisionShape): number;
}

/** A rotated rectangle (oriented bounding box) given by its four corners. */
export class ObbShape implements CollisionShape {
  readonly shapeType = ShapeType.Rectangle;

  constructor(readonly corners: Point2[]) {}

  get center(): Point2 {
    return {
      x: (this.corners[0].x + this.corners[2].x) / 2,
      y: (this.corners[0].y + this.corners[2].y) / 2,
    };
  }

  boundingRadius(): number {
    const c = this.center;
    let max = 0;
    for (const p of this.corners) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d > max) max = d;
    }
    return max;
  }

  overlapRatio(other: CollisionShape): number {
    if (other instanceof ObbShape) {
      return convexOverlapRatio(this.corners, other.corners);
    }
    // The circle owns the exact circle-vs-rectangle math; delegate to it.
    if (other instanceof Circle) {
      return other.overlapWithObb(this);
    }
    return 0;
  }
}
