import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createDemo } from '../finance/demo';
import CalendarGlance from './CalendarGlance.vue';

describe('overview calendar glance', () => {
  it('shows signed totals for the selected day and moves with the keyboard', async () => {
    const data = createDemo();
    data.as_of = '2026-10-11';
    data.movements = [{ id: 1, date: '2026-10-11', kind: 'expense', amount_cents: 6420, account_id: 1, transfer_account_id: null, description: 'Groceries', commitment_key: null }];
    data.commitments = [{ key: 'pay', name: 'Payroll', kind: 'income', amount_cents: 325000, account_id: 1, transfer_account_id: null, frequency: 'once', next_date: '2026-10-12', end_date: null }];
    const wrapper = mount(CalendarGlance, { props: { data }, attachTo: document.body });
    expect(wrapper.text()).toContain('1 recorded');
    expect(wrapper.find('.glance-totals .expense').text()).toContain('−$64.20');
    const today = wrapper.find('[data-date="2026-10-11"]');
    expect(today.find('.glance-marks .expense.recorded').exists()).toBe(true);
    await today.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.find('[data-date="2026-10-12"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.text()).toContain('1 scheduled');
    expect(wrapper.find('.glance-totals .income').text()).toContain('+$3,250.00');
    expect(wrapper.find('[data-date="2026-10-12"] .glance-marks .income').classes()).not.toContain('recorded');
    wrapper.unmount();
  });
});
