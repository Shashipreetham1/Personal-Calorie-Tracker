import { describe, it, expect } from 'vitest';
import { reconcileMacros } from '../../src/modules/goals/goals.service.js';

/**
 * Macro targets are reconciled against the calorie target at 4/4/9 kcal per
 * gram. A mismatch is reported, never rejected — people set imperfect goals,
 * and refusing to save one is hostile.
 */
describe('reconcileMacros', () => {
  it('stays quiet when the macros add up', () => {
    // 150*4 + 200*4 + 67*9 = 2003 against 2000.
    const result = reconcileMacros({ dailyCalories: 2000, proteinG: 150, carbsG: 200, fatG: 67 });

    expect(result.derivedCalories).toBe(2003);
    expect(result.warning).toBeNull();
  });

  it('warns when the macros fall far short', () => {
    const result = reconcileMacros({ dailyCalories: 2500, proteinG: 50, carbsG: 50, fatG: 20 });

    expect(result.derivedCalories).toBe(580);
    expect(result.differencePercent).toBe(-77);
    expect(result.warning).toMatch(/580 kcal/);
    expect(result.warning).toMatch(/less than/);
  });

  it('warns when the macros overshoot', () => {
    const result = reconcileMacros({ dailyCalories: 1500, proteinG: 200, carbsG: 200, fatG: 100 });

    expect(result.differencePercent).toBeGreaterThan(15);
    expect(result.warning).toMatch(/more than/);
  });

  it('accepts a drift just inside the tolerance', () => {
    // +15% exactly: 2300 derived against a 2000 target.
    expect(reconcileMacros({ dailyCalories: 2000, proteinG: 0, carbsG: 575, fatG: 0 }).warning).toBeNull();
  });

  it('warns at a drift just outside the tolerance', () => {
    // +16%.
    expect(reconcileMacros({ dailyCalories: 2000, proteinG: 0, carbsG: 580, fatG: 0 }).warning).not.toBeNull();
  });

  it('warns rather than dividing by zero when all macros are zero', () => {
    const result = reconcileMacros({ dailyCalories: 2000, proteinG: 0, carbsG: 0, fatG: 0 });

    expect(result.derivedCalories).toBe(0);
    expect(result.differencePercent).toBe(-100);
    expect(result.warning).not.toBeNull();
  });
});
