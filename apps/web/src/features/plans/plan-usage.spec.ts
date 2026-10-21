import { planLimitReached, planUsageBars, reachedLimit, usageBar } from './plan-usage';

describe('the usage against the limits of the plan', () => {
  it('shows how much of the limit is used', () => {
    expect(usageBar(3, 5)).toEqual({
      percent: 60,
      remaining: 2,
      reached: false,
      over: false,
      unlimited: false,
    });
  });

  it('marks the limit as reached', () => {
    expect(usageBar(5, 5)).toMatchObject({ reached: true, over: false, remaining: 0 });
  });

  it('marks a depot that uses more than the limit', () => {
    expect(usageBar(7, 5)).toMatchObject({ reached: true, over: true, percent: 100 });
  });

  it('has no bar when the plan has no limit', () => {
    expect(usageBar(12, null)).toEqual({
      percent: 0,
      remaining: null,
      reached: false,
      over: false,
      unlimited: true,
    });
  });

  it('treats a limit of zero as no limit', () => {
    expect(usageBar(3, 0).unlimited).toBe(true);
  });

  it('never shows a negative usage', () => {
    expect(usageBar(-2, 5)).toMatchObject({ percent: 0, remaining: 5, reached: false });
  });

  it('builds the bar of the users and of the products', () => {
    const bars = planUsageBars({ users: 2, products: 10 }, { users: 5, products: 10 });

    expect(bars.users.percent).toBe(40);
    expect(bars.products.reached).toBe(true);
    expect(planLimitReached(bars)).toBe(true);
    expect(reachedLimit(bars)).toBe('products');
  });

  it('names no limit when nothing is reached', () => {
    const bars = planUsageBars({ users: 1, products: 1 }, { users: 5, products: 10 });

    expect(planLimitReached(bars)).toBe(false);
    expect(reachedLimit(bars)).toBeNull();
  });
});
