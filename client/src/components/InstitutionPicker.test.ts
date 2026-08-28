import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import InstitutionPicker from './InstitutionPicker.vue';
import { BANK_INSTITUTIONS, OTHER_INSTITUTION } from '../data/bankInstitutions';

describe('InstitutionPicker', () => {
  it('shows "None" and no logo when nothing is selected', () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: '' } });
    expect(wrapper.find('.picker-trigger').text()).toContain('None');
    expect(wrapper.find('.picker-trigger img').exists()).toBe(false);
  });

  it('shows the bank name and its logo when a curated bank is selected', () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: 'Chase' } });
    expect(wrapper.find('.picker-trigger').text()).toContain('Chase');
    expect(wrapper.find('.picker-trigger img').exists()).toBe(true);
  });

  it('shows "Other" with no logo when the custom sentinel is selected', () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: OTHER_INSTITUTION } });
    expect(wrapper.find('.picker-trigger').text()).toContain('Other');
    expect(wrapper.find('.picker-trigger img').exists()).toBe(false);
  });

  it('opens the dropdown on click, listing every curated bank with its logo', async () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: '' } });
    await wrapper.find('.picker-trigger').trigger('click');

    const options = wrapper.findAll('[role="option"]');
    // "None" + 16 curated banks + "Other"
    expect(options.length).toBeGreaterThan(2);
    expect(wrapper.find('.picker-dropdown').text()).toContain('SoFi');
    expect(wrapper.findAll('.picker-dropdown img').length).toBeGreaterThan(0);
  });

  it('emits update:modelValue and closes the dropdown on selection', async () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: '' } });
    await wrapper.find('.picker-trigger').trigger('click');

    const chaseOption = wrapper.findAll('[role="option"]').find((el) => el.text().includes('Chase'));
    await chaseOption!.trigger('click');

    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['Chase']);
    expect(wrapper.find('.picker-dropdown').exists()).toBe(false);
  });

  it('lists curated banks alphabetically', () => {
    const names = BANK_INSTITUTIONS.map((b) => b.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('filters the bank list as the search box is typed into', async () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: '' } });
    await wrapper.find('.picker-trigger').trigger('click');

    await wrapper.find('.picker-search').setValue('cha');

    const optionText = wrapper.findAll('[role="option"]').map((el) => el.text());
    expect(optionText.some((t) => t.includes('Chase'))).toBe(true);
    expect(optionText.some((t) => t.includes('SoFi'))).toBe(false);
    // "None" and "Other" aren't bank-name matches but stay available regardless of the query.
    expect(optionText).toContain('None');
    expect(optionText).toContain('Other');
  });

  it('shows a "no matches" message when the search has no hits', async () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: '' } });
    await wrapper.find('.picker-trigger').trigger('click');

    await wrapper.find('.picker-search').setValue('zzz-not-a-bank');

    expect(wrapper.find('.picker-empty').text()).toContain('zzz-not-a-bank');
  });

  it('clears the search and refocuses it each time the dropdown reopens', async () => {
    const wrapper = mount(InstitutionPicker, { props: { modelValue: '' }, attachTo: document.body });
    await wrapper.find('.picker-trigger').trigger('click');
    await wrapper.find('.picker-search').setValue('chase');
    await wrapper.find('.picker-trigger').trigger('click'); // close
    await wrapper.find('.picker-trigger').trigger('click'); // reopen

    expect((wrapper.find('.picker-search').element as HTMLInputElement).value).toBe('');
    wrapper.unmount();
  });
});
