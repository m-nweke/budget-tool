import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import FinanceTour from './FinanceTour.vue';
import { endTour, maybeAutoStart, startTour, tour, tourSeen, tourSteps } from '../finance/tour';

const Page = { template: '<div><section class="spend-panel">s</section><section class="trajectory-panel">t</section></div>' };

beforeEach(() => { localStorage.clear(); tour.active = false; tour.index = 0; });
afterEach(() => { tour.active = false; });

describe('tour state', () => {
  it('auto-starts once for the demo and waits for an account in a real workspace', () => {
    maybeAutoStart('personal', false);
    expect(tour.active).toBe(false);
    maybeAutoStart('demo', false);
    expect(tour.active).toBe(true);
    endTour();
    expect(tourSeen('demo')).toBe(true);
    maybeAutoStart('demo', true);
    expect(tour.active).toBe(false);
    maybeAutoStart('personal', true);
    expect(tour).toMatchObject({ active: true, mode: 'personal', index: 0 });
  });
});

describe('FinanceTour', () => {
  it('walks steps across sections, closes on Escape and remembers it was seen', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/demo/:section', component: Page }] });
    await router.push('/demo/overview');
    const wrapper = mount(FinanceTour, { props: { demo: true }, global: { plugins: [router] }, attachTo: document.body });
    startTour('demo');
    await flushPromises();
    expect(wrapper.find('#tour-title').text()).toBe(tourSteps[0]!.title);
    expect(wrapper.text()).toContain(`Step 1 of ${tourSteps.length}`);
    expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBe('tour-title');

    await wrapper.findAll('.tour-card button').find(b => b.text().startsWith('Next'))!.trigger('click');
    await wrapper.findAll('.tour-card button').find(b => b.text().startsWith('Next'))!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/demo/calendar');
    expect(wrapper.find('#tour-title').text()).toBe(tourSteps[2]!.title);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('.tour-card').exists()).toBe(false);
    expect(tourSeen('demo')).toBe(true);
    wrapper.unmount();
  });

  it('describes vaults without promising preview-only payday suggestions in a real workspace', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:section?', component: Page }] });
    await router.push('/');
    const wrapper = mount(FinanceTour, { props: { demo: false }, global: { plugins: [router] }, attachTo: document.body });
    const vaultStep = tourSteps.findIndex(step => step.section === 'plans');
    startTour('personal');
    tour.index = vaultStep;
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/plans');
    expect(wrapper.get('#tour-body').text()).toBe(tourSteps[vaultStep]!.personalBody);
    expect(wrapper.get('#tour-body').text()).toContain('preview you can try in the demo');
    wrapper.unmount();
  });
});

