import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FinanceCalendar from './FinanceCalendar.vue';
import { createDemo, demoForecast } from '../finance/demo';

function fixture() {
  const data = createDemo();
  data.as_of = '2028-02-10';
  data.commitments = [{key:'pay',name:'Payroll',kind:'income',amount_cents:250000,account_id:1,transfer_account_id:null,frequency:'monthly',next_date:'2028-02-15',end_date:null}];
  data.movements = [{id:1,date:'2028-02-10',description:'Groceries',kind:'expense',amount_cents:4512,account_id:1,transfer_account_id:null,commitment_key:null}];
  data.forecast = demoForecast(data);
  return data;
}

describe('calendar navigation and day details', () => {
  it('shows separate monthly cards for incoming, outgoing and transfers', () => {
    const data = fixture();
    data.commitments.push({key:'rent',name:'Rent',kind:'bill',amount_cents:120000,account_id:1,transfer_account_id:null,frequency:'once',next_date:'2028-02-20',end_date:null});
    data.commitments.push({key:'move',name:'Move to savings',kind:'savings',amount_cents:17500,account_id:1,transfer_account_id:2,frequency:'once',next_date:'2028-02-21',end_date:null});
    const wrapper = mount(FinanceCalendar, { props: { data } });
    const cards = wrapper.findAll('.calendar-summary-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]!.text()).toContain('+$2,500.00');
    expect(cards[1]!.text()).toContain('−$1,200.00');
    expect(cards[2]!.text()).toContain('↔ $175.00');
  });
  it('shows real activity, then future scheduled income and its selected-date action', async () => {
    const wrapper = mount(FinanceCalendar, { props: {data:fixture()} });
    expect(wrapper.get('.calendar-agenda').text()).toContain('Groceries');
    await wrapper.get('[data-date="2028-02-15"]').trigger('click');
    expect(wrapper.get('.calendar-agenda').text()).toContain('Payroll');
    expect(wrapper.get('.calendar-agenda').text()).toContain('+$2,500.00');
    expect(wrapper.get('.calendar-agenda').text()).toContain('Scheduled');
    await wrapper.get('.agenda-actions .btn').trigger('click');
    expect(wrapper.emitted('commitment')).toEqual([['2028-02-15']]);
    expect(wrapper.get('.agenda-actions .text-button').attributes('disabled')).toBeDefined();
    await wrapper.get('[data-date="2028-02-10"]').trigger('click');
    await wrapper.get('.agenda-actions .text-button').trigger('click');
    expect(wrapper.emitted('activity')).toEqual([['2028-02-10']]);
    wrapper.unmount();
  });
  it('navigates months, returns to today and supports arrow-key navigation across month boundaries', async () => {
    const wrapper = mount(FinanceCalendar, { props:{data:fixture()}, attachTo: document.body });
    await wrapper.get('[aria-label="Next month"]').trigger('click');
    expect(wrapper.get('.calendar-month-control h2').text()).toBe('March 2028');
    await wrapper.get('[data-date="2028-03-01"]').trigger('keydown', {key:'ArrowLeft'});
    expect(wrapper.get('.calendar-month-control h2').text()).toBe('February 2028');
    const leapDay=wrapper.get('[data-date="2028-02-29"]');
    expect(leapDay.attributes('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(leapDay.element);
    await wrapper.get('.calendar-month-control .text-button').trigger('click');
    expect(wrapper.get('[data-date="2028-02-10"]').attributes('aria-pressed')).toBe('true');
    wrapper.unmount();
  });
  it('filters actual and scheduled entries and explains empty days', async () => {
    const wrapper = mount(FinanceCalendar, { props:{data:fixture()} });
    await wrapper.get('.calendar-filter select').setValue('scheduled');
    expect(wrapper.get('.calendar-agenda').text()).toContain('No entries match this filter.');
    expect(wrapper.findAll('.agenda-entry')).toHaveLength(0);
    await wrapper.get('[data-date="2028-02-15"]').trigger('click');
    expect(wrapper.findAll('.agenda-entry')).toHaveLength(1);
    await wrapper.get('.calendar-filter select').setValue('recorded');
    expect(wrapper.findAll('.agenda-entry')).toHaveLength(0);
    wrapper.unmount();
  });
});
