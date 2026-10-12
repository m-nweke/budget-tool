import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Forecast } from '../finance/types';
import CashTrajectory from './CashTrajectory.vue';

const forecast = (balances: number[]): Forecast => ({
  from: '2026-10-01', to: '2026-10-03', safe_to_spend_cents: null, headroom_cents: null, next_income_date: null, window_end: '2026-10-03', warnings: [],
  daily: balances.map((balance_cents, i) => ({ date: `2026-10-0${i + 1}`, balance_cents, headroom_cents: balance_cents, accounts: {} })),
});

describe('cash trajectory y-axis', () => {
  it('labels every gridline with a rounded dollar value that spans the data', () => {
    const wrapper = mount(CashTrajectory, { props: { forecast: forecast([648250, 412000, 731500]), cushion: 100000 } });
    const labels = wrapper.findAll('.chart-y-axis span').map(s => s.text());
    expect(labels).toEqual(['$0', '$2K', '$4K', '$6K', '$8K']);
    expect(wrapper.findAll('.chart-grid')).toHaveLength(labels.length);
  });

  it('extends below zero when the forecast goes negative', () => {
    const wrapper = mount(CashTrajectory, { props: { forecast: forecast([50000, -30000, 20000]), cushion: 10000 } });
    const labels = wrapper.findAll('.chart-y-axis span').map(s => s.text());
    expect(labels[0]).toBe('-$400');
    expect(labels).toContain('$0');
    expect(wrapper.find('.chart-grid.zero').exists()).toBe(true);
  });
});
