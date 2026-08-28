import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BankLogo from './BankLogo.vue';

describe('BankLogo', () => {
  it('renders nothing when institution is unset', () => {
    const wrapper = mount(BankLogo, { props: { institution: null } });
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('span').exists()).toBe(false);
  });

  it('renders the real logo image for a curated bank', () => {
    const wrapper = mount(BankLogo, { props: { institution: 'Chase' } });
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://www.google.com/s2/favicons?domain=chase.com&sz=64');
  });

  it('falls back to the letter-mark badge for a custom institution with no known domain', () => {
    const wrapper = mount(BankLogo, { props: { institution: 'My Local Credit Union' } });
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('span.bank-logo').text()).toBe('ML');
  });

  it('falls back to the letter-mark badge when the logo image fails to load', async () => {
    const wrapper = mount(BankLogo, { props: { institution: 'Chase' } });
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('span.bank-logo').text()).toBe('C');
  });

  it('defaults to the circle shape and switches to squircle when requested', () => {
    const circle = mount(BankLogo, { props: { institution: 'Chase' } });
    expect(circle.find('img').classes()).toContain('shape-circle');

    const squircle = mount(BankLogo, { props: { institution: 'Chase', shape: 'squircle' } });
    expect(squircle.find('img').classes()).toContain('shape-squircle');
  });

  it('applies the requested size to both the image and the fallback badge', () => {
    const withLogo = mount(BankLogo, { props: { institution: 'Chase', size: '2.25rem' } });
    expect(withLogo.find('img').attributes('style')).toContain('width: 2.25rem');

    const fallback = mount(BankLogo, { props: { institution: 'My Local Credit Union', size: '2.25rem' } });
    expect(fallback.find('span.bank-logo').attributes('style')).toContain('width: 2.25rem');
  });
});
