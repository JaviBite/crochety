import { describe, expect, it } from "vitest";
import {
  AI_STATUS_TONES,
  ORDER_STATUS_TONES,
  aiStatusTone,
  orderStatusTone,
} from "@/lib/status";
import { PATTERN_AI_STATUSES, ORDER_STATUSES } from "@/lib/validations";

describe("orderStatusTone", () => {
  it("devuelve un tono para cada estado conocido", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_TONES[status]).toBeDefined();
      expect(orderStatusTone(status)).toBe(ORDER_STATUS_TONES[status]);
    }
  });

  it("cae al tono neutro con estados desconocidos (String en BD)", () => {
    expect(orderStatusTone("QUE_SEA")).toEqual(ORDER_STATUS_TONES.SIN_EMPEZAR);
  });
});

describe("aiStatusTone", () => {
  it("devuelve un tono para cada estado conocido", () => {
    for (const status of PATTERN_AI_STATUSES) {
      expect(AI_STATUS_TONES[status]).toBeDefined();
      expect(aiStatusTone(status)).toBe(AI_STATUS_TONES[status]);
    }
  });

  it("cae al tono neutro con estados desconocidos", () => {
    expect(aiStatusTone("vacio")).toEqual(AI_STATUS_TONES.NONE);
  });
});
