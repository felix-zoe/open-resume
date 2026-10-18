import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a clean storage between tests', () => {
    expect(localStorage.length).toBe(0);
  });
});
