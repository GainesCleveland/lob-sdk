import { BoundingBox, ShapeType } from "../types";
import { Point2, Vector2 } from "@lob-sdk/vector";
import { CollisionShape, ObbShape } from "../collision-shape";

export class Circle implements CollisionShape {
  readonly shapeType = ShapeType.Circle;
  public position: Vector2;
  public radius: number;

  constructor(centerX: number, centerY: number, radius: number) {
    if (radius < 0) {
      throw new Error("Radius must not be negative");
    }
    this.position = new Vector2(centerX, centerY);
    this.radius = radius;
  }

  private _boundingBox: BoundingBox | null = null;
  get boundingBox() {
    if (!this._boundingBox) {
      this._boundingBox = this.calculateBoundingBox();
    }

    return this._boundingBox;
  }

  private calculateBoundingBox(): BoundingBox {
    return {
      minX: this.position.x - this.radius,
      maxX: this.position.x + this.radius,
      minY: this.position.y - this.radius,
      maxY: this.position.y + this.radius,
    };
  }

  /**
   * Checks if this circle collides with another and returns the squared distance between their centers if they collide
   * @param other The other circle to check collision with
   * @returns The squared distance between the centers if the circles collide, or null if they don't
   */
  getCollisionSquaredDistance(other: Circle): number | null {
    const distanceSquared = this.position.squaredDistanceTo(other.position);
    const radiusSum = this.radius + other.radius;
    if (distanceSquared < radiusSum * radiusSum) {
      // Collision occurs, return the squared distance
      return distanceSquared;
    }
    // No collision
    return null;
  }

  /**
   * Check if a point is inside the circle
   */
  isPointInside(point: Point2): boolean {
    // Calculate distance squared (avoid square root for performance)
    const dx = point.x - this.position.x;
    const dy = point.y - this.position.y;
    const distanceSquared = dx * dx + dy * dy;

    return distanceSquared <= this.radius * this.radius;
  }

  /**
   * Check if circle intersects with a line segment, optionally considering line width
   * @param lineStart Starting point of the line segment
   * @param lineEnd Ending point of the line segment
   * @param lineWidth Optional width of the line (default: 0, infinitely thin)
   * @returns true if the circle intersects with the line segment, false otherwise
   */
  intersectsWithLine(
    lineStart: Point2,
    lineEnd: Point2,
    lineWidth: number = 0,
  ): boolean {
    // Quick check using bounding box, adjusted for line width
    const halfWidth = lineWidth / 2;

    const lineBoxMinX = Math.min(lineStart.x, lineEnd.x) - halfWidth;
    const lineBoxMaxX = Math.max(lineStart.x, lineEnd.x) + halfWidth;
    const lineBoxMinY = Math.min(lineStart.y, lineEnd.y) - halfWidth;
    const lineBoxMaxY = Math.max(lineStart.y, lineEnd.y) + halfWidth;

    if (
      this.boundingBox.minX > lineBoxMaxX ||
      this.boundingBox.maxX < lineBoxMinX ||
      this.boundingBox.minY > lineBoxMaxY ||
      this.boundingBox.maxY < lineBoxMinY
    ) {
      return false;
    }

    // Check if either endpoint is inside the circle
    if (this.isPointInside(lineStart) || this.isPointInside(lineEnd)) {
      return true;
    }

    // Calculate closest point on line segment to circle center
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y; // Fixed: Correct dy calculation
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      return this.isPointInside(lineStart); // Line segment is a point
    }

    // Calculate projection of circle center onto line
    let t =
      ((this.position.x - lineStart.x) * dx +
        (this.position.y - lineStart.y) * dy) /
      lengthSquared;

    // If the projection is outside 0-1, we will check if it can overlap without the added width.
    // This cuts off the rounded caps on projectile width.
    if (t < 0) {
      // Past the start: Check distance to the flat plane at lineStart
      const distBefore = -t * Math.sqrt(lengthSquared);
      if (distBefore > this.radius) return false;
    } else if (t > 1) {
      // Past the end: Check distance to the flat plane at lineEnd
      const distPast = (t - 1) * Math.sqrt(lengthSquared);
      if (distPast > this.radius) return false;
    }

    // Now we can clamp T to do the width check safely
    t = Math.max(0, Math.min(1, t));

    const closestPoint: Point2 = {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy,
    };

    // Check distance to closest point, accounting for line width
    const dxToClosest = this.position.x - closestPoint.x;
    const dyToClosest = this.position.y - closestPoint.y;
    const distanceSquared =
      dxToClosest * dxToClosest + dyToClosest * dyToClosest;
    const effectiveRadius = this.radius + halfWidth;

    return distanceSquared <= effectiveRadius * effectiveRadius;
  }

  getRadius(): number {
    return this.radius;
  }

  getBoundingBox(): BoundingBox {
    return { ...this.boundingBox };
  }

  /**
   * Check if this circle intersects with any circle in the provided array
   * @param circles Array of circles to check intersection with
   * @returns true if this circle intersects with any circle in the array, false otherwise
   */
  intersectsWithCircles(circles: Circle[]): boolean {
    // Quick check using bounding boxes
    for (const other of circles) {
      if (
        this.boundingBox.minX <= other.boundingBox.maxX &&
        this.boundingBox.maxX >= other.boundingBox.minX &&
        this.boundingBox.minY <= other.boundingBox.maxY &&
        this.boundingBox.maxY >= other.boundingBox.minY
      ) {
        // If bounding boxes intersect, check for actual circle intersection
        if (this.getCollisionSquaredDistance(other) !== null) {
          return true;
        }
      }
    }
    return false;
  }

  // --- CollisionShape: a unit footprint whose overlap is resolved by shape pair ---

  get center(): Point2 {
    return this.position;
  }

  boundingRadius(): number {
    return this.radius;
  }

  overlapRatio(other: CollisionShape): number {
    if (other instanceof Circle) {
      return this.overlapWithCircle(other);
    }
    if (other instanceof ObbShape) {
      return this.overlapWithObb(other);
    }
    return 0;
  }

  /**
   * Overlap with another circle as a fraction (0..1) of the smaller disc's area: 0
   * when disjoint, 1 when the smaller sits fully inside the larger, the lens-area
   * fraction in between. A zero-radius circle (no-collision) overlaps nothing.
   */
  private overlapWithCircle(other: Circle): number {
    const r1 = this.radius;
    const r2 = other.radius;
    if (r1 <= 0 || r2 <= 0) return 0;
    const d = Math.hypot(
      other.position.x - this.position.x,
      other.position.y - this.position.y,
    );
    if (d >= r1 + r2) return 0;
    if (d <= Math.abs(r1 - r2)) return 1;

    const r1s = r1 * r1;
    const r2s = r2 * r2;
    const a1 = Math.acos((d * d + r1s - r2s) / (2 * d * r1));
    const a2 = Math.acos((d * d + r2s - r1s) / (2 * d * r2));
    const lens =
      r1s * a1 +
      r2s * a2 -
      0.5 *
        Math.sqrt(
          Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)),
        );
    const minArea = Math.PI * Math.min(r1, r2) ** 2;
    return Math.min(lens / minArea, 1);
  }

  /**
   * Overlap with a rotated rectangle as a fraction (0..1) of the smaller footprint.
   * The circle stays exact: move it into the rectangle's local frame so the box is
   * axis-aligned, then measure the circle-AABB intersection area. Public so
   * `ObbShape.overlapRatio` can delegate the cross-shape pair here.
   */
  overlapWithObb(obb: ObbShape): number {
    const r = this.radius;
    if (r <= 0) return 0;
    const corners = obb.corners;
    const c0 = corners[0];
    const c2 = corners[2];
    let ux = corners[1].x - c0.x;
    let uy = corners[1].y - c0.y;
    let vx = corners[3].x - c0.x;
    let vy = corners[3].y - c0.y;
    const lu = Math.hypot(ux, uy) || 1;
    const lv = Math.hypot(vx, vy) || 1;
    ux /= lu;
    uy /= lu;
    vx /= lv;
    vy /= lv;

    const cx = (c0.x + c2.x) / 2;
    const cy = (c0.y + c2.y) / 2;
    const relX = this.position.x - cx;
    const relY = this.position.y - cy;
    const lx = relX * ux + relY * uy;
    const ly = relX * vx + relY * vy;
    const hu = lu / 2;
    const hv = lv / 2;

    const inter = Circle.circleAabbArea(r, -hu - lx, -hv - ly, hu - lx, hv - ly);
    const minArea = Math.min(Math.PI * r * r, lu * lv);
    return minArea > 0 ? Math.min(inter / minArea, 1) : 0;
  }

  /** Intersection area of a disc (radius r at the origin) and the box [x0,x1]x[y0,y1]. */
  private static circleAabbArea(
    r: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): number {
    const xa = Math.max(x0, -r);
    const xb = Math.min(x1, r);
    if (xa >= xb) return 0;

    const strips = 64;
    const dx = (xb - xa) / strips;
    let area = 0;
    for (let i = 0; i < strips; i++) {
      const x = xa + (i + 0.5) * dx;
      const h = Math.sqrt(Math.max(0, r * r - x * x));
      const lo = Math.max(y0, -h);
      const hi = Math.min(y1, h);
      if (hi > lo) area += (hi - lo) * dx;
    }
    return area;
  }
}
