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
    expect(wrapper.text()).toContain('Left for everything else');
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
    expect(text).toContain('When you’re paid into Everyday checking, we suggest setting aside 12% of it. You approve it first.');
    expect(text).toContain('When you’re paid into Everyday checking, we suggest setting aside $150.00. You approve it first.');
    expect(text).toContain('Kept in Rainy day fund');
    expect(text).not.toMatch(/by \d{4}-\d{2}-\d{2}/);
  });

  it('explains vaults in plain language, gives a monthly target, and remembers when the guide is hidden', async () => {
    localStorage.removeItem('vault-explainer-hidden');
    const data = createDemo();
    data.as_of = '2026-10-11';
    data.goals = [{ id: 1, name: 'Trip', target_cents: 450000, saved_cents: 285000, account_id: 2, target_date: '2027-02-08' }];
    const wrapper = mount(FinanceVaults, { props: { data, demo: true }, global: { stubs: ['RouterLink'] } });
    expect(wrapper.text()).toContain('How vaults work');
    expect(wrapper.text()).toContain('labeled envelope');
    expect(wrapper.get('.vault-plan').text()).toBe('$1,650.00 to go. Save about $413.00 a month to finish by Feb 8, 2027.');
    await wrapper.findAll('button').find(b => b.text() === 'Got it, hide this')!.trigger('click');
    expect(wrapper.find('.vault-explainer').exists()).toBe(false);
    expect(localStorage.getItem('vault-explainer-hidden')).toBe('1');
    await wrapper.findAll('button').find(b => b.text() === 'Emergency fund')!.trigger('click');
    expect((wrapper.get('.vault-form input').element as HTMLInputElement).value).toBe('Emergency fund');
  });
});

