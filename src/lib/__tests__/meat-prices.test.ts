import { describe, it, expect } from "vitest";
import { parseGrade, buildSearchUrl, GRADE_RANK, MEAT_CUTS, STORES } from "../meat-prices";

describe("parseGrade", () => {
  it("detects USDA Prime", () => {
    expect(parseGrade("Hy-Vee Prime Reserve Ribeye Steak")).toBe("Prime");
  });

  it("detects USDA Choice even when Angus is also present", () => {
    // Choice (an actual USDA grade) must win over Angus (a breed)
    expect(parseGrade("USDA Choice Black Angus Ribeye Steak")).toBe("Choice");
  });

  it("detects Select", () => {
    expect(parseGrade("USDA Select Sirloin")).toBe("Select");
  });

  it("falls back to Angus when no USDA grade is present", () => {
    expect(parseGrade("Black Angus Ribeye Steak")).toBe("Angus");
  });

  it("detects Wagyu", () => {
    expect(parseGrade("American Wagyu NY Strip")).toBe("Wagyu");
  });

  it("returns Ungraded when nothing matches", () => {
    expect(parseGrade("Ground Beef 80/20")).toBe("Ungraded");
  });

  it("is case-insensitive", () => {
    expect(parseGrade("usda PRIME ribeye")).toBe("Prime");
  });
});

describe("GRADE_RANK", () => {
  it("orders grades Wagyu > Prime > Choice > Angus > Select > Ungraded", () => {
    expect(GRADE_RANK.Wagyu).toBeGreaterThan(GRADE_RANK.Prime);
    expect(GRADE_RANK.Prime).toBeGreaterThan(GRADE_RANK.Choice);
    expect(GRADE_RANK.Choice).toBeGreaterThan(GRADE_RANK.Angus);
    expect(GRADE_RANK.Angus).toBeGreaterThan(GRADE_RANK.Select);
    expect(GRADE_RANK.Select).toBeGreaterThan(GRADE_RANK.Ungraded);
  });

  it("has a rank for every grade parseGrade can return", () => {
    const grades = [
      parseGrade("wagyu x"),
      parseGrade("prime x"),
      parseGrade("choice x"),
      parseGrade("select x"),
      parseGrade("angus x"),
      parseGrade("plain beef"),
    ];
    for (const grade of grades) {
      expect(GRADE_RANK[grade]).toBeDefined();
    }
  });
});

describe("buildSearchUrl", () => {
  // Regression guard: links must be store SEARCH URLs, never deep product
  // links. Deep links 404 (Aldi's Instacart migration killed all old URLs).
  it("builds Aldi Instacart-storefront search URLs", () => {
    const url = buildSearchUrl("ALDI", "ribeye steak");
    expect(url).toBe("https://www.aldi.us/store/aldi/search?query=ribeye%20steak");
  });

  it("builds Hy-Vee aisles-online search URLs", () => {
    const url = buildSearchUrl("Hy-Vee", "ribeye steak");
    expect(url).toBe("https://www.hy-vee.com/aisles-online/search?search=ribeye%20steak");
  });

  it("encodes special characters in queries", () => {
    const url = buildSearchUrl("ALDI", "ground beef 80/20");
    expect(url).toContain("80%2F20");
  });
});

describe("catalogs", () => {
  it("tracks both stores", () => {
    expect(STORES).toEqual(["ALDI", "Hy-Vee"]);
  });

  it("includes the core steak cuts and ground beef", () => {
    expect(MEAT_CUTS).toContain("Ribeye");
    expect(MEAT_CUTS).toContain("NY Strip");
    expect(MEAT_CUTS).toContain("T-Bone");
    expect(MEAT_CUTS).toContain("Ground Beef 80/20");
    expect(MEAT_CUTS.length).toBeGreaterThanOrEqual(10);
  });
});
