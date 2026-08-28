import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import InstitutionPicker from './InstitutionPicker.vue';
import { OTHER_INSTITUTION } from '../data/bankInstitutions';

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
});
