import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createDemo } from '../finance/demo';
import FinanceVaults from './FinanceVaults.vue';

describe('demo vault allocation review', () => {
  it('caps overlapping suggestions, rejects over-allocation, and leaves account balances untouched', async () => {
    const data = createDemo();
    const balance = data.accounts[0]!.balance_cents;
    const wrapper = mount(FinanceVaults, { props: { data, demo: true }, global: { stubs: ['RouterLink'] } });
    expect(wrapper.text()).toContain('Your vaults');
    expect(wrapper.text()).toContain('Left unallocated');
    const inputs = wrapper.findAll('.vault-edit-amount input');
    expect(inputs).toHaveLength(2);
    await inputs[0]!.setValue('3200');
    expect(wrapper.get('.vault-remainder').text()).toContain('-$100.00');
    expect(wrapper.get('.vault-review-actions .btn').attributes('disabled')).toBeDefined();
    await inputs[0]!.setValue('300');
    await wrapper.get('.vault-review-actions .btn').trigger('click');
    expect(wrapper.get('[role="status"]').text()).toContain('no balances or transfers changed');
    expect(data.accounts[0]!.balance_cents).toBe(balance);
    await wrapper.get('.vault-review-actions .text-button').trigger('click');
    expect(wrapper.get('.vault-remainder').text()).toContain('$3,250.00');
  });

  it('states each rule trigger, the review step and the holding account on the card', () => {
    const wrapper = mount(FinanceVaults, { props: { data: createDemo(), demo: true }, global: { stubs: ['RouterLink'] } });
    const text = wrapper.text();
    expect(text).toContain('Suggests 12% of each Everyday checking deposit · you review first');
    expect(text).toContain('Suggests $150.00 from each Everyday checking deposit · you review first');
    expect(text).toContain('Held in Rainy day fund');
    expect(text).not.toMatch(/by \d{4}-\d{2}-\d{2}/);
  });
});
