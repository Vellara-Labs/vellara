import { describe, it, expect } from "vitest";
import { useAmountValidation } from "./validation";

describe("useAmountValidation", () => {
  describe("empty and whitespace input", () => {
    it("considers empty string valid", () => {
      const result = useAmountValidation("");
      expect(result).toEqual({ isValid: true, error: null });
    });

    it("considers whitespace-only string valid", () => {
      const result = useAmountValidation("   ");
      expect(result).toEqual({ isValid: true, error: null });
    });
  });

  describe("invalid numeric input", () => {
    it("rejects non-numeric string 'abc'", () => {
      const result = useAmountValidation("abc");
      expect(result).toEqual({
        isValid: false,
        error: "Amount must be a valid number",
      });
    });

    it("rejects special characters", () => {
      const result = useAmountValidation("$100");
      expect(result).toEqual({
        isValid: false,
        error: "Amount must be a valid number",
      });
    });
  });

  describe("zero and negative values", () => {
    it("rejects '0'", () => {
      const result = useAmountValidation("0");
      expect(result).toEqual({
        isValid: false,
        error: "Amount must be greater than zero",
      });
    });

    it("rejects '-1'", () => {
      const result = useAmountValidation("-1");
      expect(result).toEqual({
        isValid: false,
        error: "Amount must be greater than zero",
      });
    });

    it("rejects negative decimals '-0.5'", () => {
      const result = useAmountValidation("-0.5");
      expect(result).toEqual({
        isValid: false,
        error: "Amount must be greater than zero",
      });
    });
  });

  describe("non-finite numbers", () => {
    it("rejects 'Infinity'", () => {
      const result = useAmountValidation("Infinity");
      expect(result).toEqual({
        isValid: false,
        error: "Amount must be a finite number",
      });
    });
  });

  describe("decimal precision boundaries", () => {
    it("accepts exactly 7 decimal places for Stellar default precision (e.g. '1.2345678')", () => {
      const result = useAmountValidation("1.2345678", 7);
      expect(result).toEqual({ isValid: true, error: null });
    });

    it("rejects exactly 8 decimal places when 7 decimals are allowed", () => {
      const result = useAmountValidation("1.23456789", 7);
      expect(result).toEqual({
        isValid: false,
        error: "Amount can have at most 7 decimal places",
      });
    });

    it("accepts inputs with fewer decimal places than allowed", () => {
      const result = useAmountValidation("10.5", 7);
      expect(result).toEqual({ isValid: true, error: null });
    });

    it("respects custom decimal limits (boundary at 2 and 3 decimals)", () => {
      const valid = useAmountValidation("42.50", 2);
      expect(valid).toEqual({ isValid: true, error: null });

      const invalid = useAmountValidation("42.505", 2);
      expect(invalid).toEqual({
        isValid: false,
        error: "Amount can have at most 2 decimal places",
      });
    });
  });

  describe("maximum safe integer range", () => {
    it("rejects values whose converted stroops exceed Number.MAX_SAFE_INTEGER", () => {
      // With decimals=7, multiplier=10^7.
      // Number.MAX_SAFE_INTEGER is 9007199254740991.
      // 900719926 * 10^7 = 9007199260000000 > MAX_SAFE_INTEGER
      const excessiveValue = "900719926";
      const expectedError = `Amount exceeds maximum allowed value (${(
        Number.MAX_SAFE_INTEGER / Math.pow(10, 7)
      ).toLocaleString()})`;

      const result = useAmountValidation(excessiveValue, 7);
      expect(result).toEqual({
        isValid: false,
        error: expectedError,
      });
    });

    it("rejects extremely large numbers", () => {
      const massiveValue = "999999999999999999";
      const expectedError = `Amount exceeds maximum allowed value (${(
        Number.MAX_SAFE_INTEGER / Math.pow(10, 7)
      ).toLocaleString()})`;

      const result = useAmountValidation(massiveValue, 7);
      expect(result).toEqual({
        isValid: false,
        error: expectedError,
      });
    });
  });

  describe("valid inputs", () => {
    it("accepts positive integers", () => {
      expect(useAmountValidation("1")).toEqual({ isValid: true, error: null });
      expect(useAmountValidation("100")).toEqual({ isValid: true, error: null });
      expect(useAmountValidation("50000")).toEqual({ isValid: true, error: null });
    });

    it("accepts valid fractional amounts within range", () => {
      expect(useAmountValidation("0.0000001", 7)).toEqual({ isValid: true, error: null });
      expect(useAmountValidation("100.25", 7)).toEqual({ isValid: true, error: null });
    });
  });
});
