import {
  segmentCircleCoverage,
  segmentConvexCoverage,
  mergeIntervals,
  coveredFraction,
  freeFraction,
  freeIntervals,
} from "./segment-coverage";
import { Point2 } from "@lob-sdk/vector";

const P = (x: number, y: number): Point2 => ({ x, y });

describe("segment-coverage", () => {
  describe("segmentCircleCoverage", () => {
    const a = P(0, 0);
    const b = P(10, 0);

    it("covers the chord under a circle centred on the segment", () => {
      // circle at (5,0) r=2 -> x in [3,7] -> t in [0.3,0.7]
      expect(segmentCircleCoverage(a, b, 5, 0, 2)).toEqual([0.3, 0.7]);
    });

    it("clamps to the segment ends", () => {
      // circle at (0,0) r=2 -> t in [0,0.2]
      expect(segmentCircleCoverage(a, b, 0, 0, 2)).toEqual([0, 0.2]);
    });

    it("returns null when the circle is too far (perp distance)", () => {
      expect(segmentCircleCoverage(a, b, 5, 3, 2)).toBeNull();
    });

    it("returns null when the circle is past the segment", () => {
      expect(segmentCircleCoverage(a, b, 20, 0, 2)).toBeNull();
    });
  });

  describe("segmentConvexCoverage", () => {
    // Axis-aligned square [2,6] x [2,6].
    const square: Point2[] = [P(2, 2), P(6, 2), P(6, 6), P(2, 6)];

    it("covers the part of the segment inside the polygon", () => {
      // horizontal segment at y=5 from x=0..10 -> inside for x in [2,6] -> t [0.2,0.6]
      const cov = segmentConvexCoverage(P(0, 5), P(10, 5), square);
      expect(cov![0]).toBeCloseTo(0.2);
      expect(cov![1]).toBeCloseTo(0.6);
    });

    it("returns null when the segment misses the polygon", () => {
      expect(segmentConvexCoverage(P(0, 20), P(10, 20), square)).toBeNull();
    });

    it("covers the whole segment when it lies inside", () => {
      const cov = segmentConvexCoverage(P(3, 5), P(5, 5), square);
      expect(cov![0]).toBeCloseTo(0);
      expect(cov![1]).toBeCloseTo(1);
    });
  });

  describe("interval helpers", () => {
    it("merges overlapping intervals", () => {
      expect(
        mergeIntervals([
          [0.1, 0.3],
          [0.2, 0.5],
          [0.7, 0.9],
        ]),
      ).toEqual([
        [0.1, 0.5],
        [0.7, 0.9],
      ]);
    });

    it("coveredFraction sums the merged union", () => {
      expect(
        coveredFraction([
          [0.1, 0.3],
          [0.2, 0.5],
          [0.7, 0.9],
        ]),
      ).toBeCloseTo(0.6); // (0.5-0.1) + (0.9-0.7)
    });

    it("freeFraction is the complement", () => {
      expect(freeFraction([[0.2, 0.6]])).toBeCloseTo(0.6);
    });

    it("freeIntervals are the gaps", () => {
      expect(freeIntervals([[0.2, 0.6]])).toEqual([
        [0, 0.2],
        [0.6, 1],
      ]);
    });

    it("full coverage leaves no free intervals", () => {
      expect(freeIntervals([[0, 1]])).toEqual([]);
      expect(freeFraction([[0, 1]])).toBe(0);
    });

    it("does not mutate the input intervals", () => {
      const input: [number, number][] = [
        [0.2, 0.5],
        [0.1, 0.3],
      ];
      mergeIntervals(input);
      expect(input).toEqual([
        [0.2, 0.5],
        [0.1, 0.3],
      ]);
    });
  });
});
