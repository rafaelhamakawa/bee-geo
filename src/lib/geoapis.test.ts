import { describe, expect, it } from "vitest";

import { FORAGING_CIRCLE_AREA_HA, ONE_PERCENT_AREA_HA, calculateAnalysis } from "./geoapis";

describe("GeoApis forage calculations", () => {
  it("uses a 1.5 km circle with approximately 706.86 hectares", () => {
    expect(FORAGING_CIRCLE_AREA_HA).toBeCloseTo(706.8583, 4);
    expect(ONE_PERCENT_AREA_HA).toBeCloseTo(7.0686, 4);
  });

  it("applies the biome multiplier and the 0.85 safety factor", () => {
    const result = calculateAnalysis({
      apiaryId: "apiary-1",
      category: "cerrado",
      fragments: [{ id: "fragment-1", label: "Área 1", areaHa: ONE_PERCENT_AREA_HA * 10 }],
    });

    expect(result.pasturePercentage).toBeCloseTo(10, 8);
    expect(result.hivesBeforeSafety).toBeCloseTo(20, 8);
    expect(result.recommendedHives).toBe(17);
  });

  it("caps pasture area at the total circle area", () => {
    const result = calculateAnalysis({
      apiaryId: "apiary-1",
      category: "acacia-mangium",
      fragments: [{ id: "fragment-1", label: "Área 1", areaHa: 900 }],
    });

    expect(result.pasturePercentage).toBe(100);
    expect(result.recommendedHives).toBe(680);
  });
});
