import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import FinanceWorkspace from './FinanceWorkspace.vue';
import { useFinance } from '../finance/useFinance';

beforeEach(() => { useFinance(() => true).resetDemo(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());

describe('isolated finance demo', () => {
  it('opens the overview and calendar without contacting the authenticated API', async () => {
    const router=createRouter({history:createMemoryHistory(),routes:[{path:'/demo/:section',component:FinanceWorkspace}]});
    await router.push('/demo/overview');
    const wrapper=mount(FinanceWorkspace,{global:{plugins:[router]}});
    await flushPromises();
    expect(wrapper.text()).toContain('Safe to spend');
    await router.push('/demo/calendar'); await flushPromises();
    expect(wrapper.findComponent({name:'FinanceCalendar'}).exists()).toBe(true);
    expect(wrapper.text()).toContain('Scheduled this month');
    expect(fetch).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('toggles the overview panel between trajectory and calendar and remembers the choice', async () => {
    localStorage.removeItem('overview-glance');
    const router=createRouter({history:createMemoryHistory(),routes:[{path:'/demo/:section',component:FinanceWorkspace}]});
    await router.push('/demo/overview');
    const wrapper=mount(FinanceWorkspace,{global:{plugins:[router]}});
    await flushPromises();
    const toggle=wrapper.find('[aria-label="Panel view"]');
    const [trajectory,calendar]=toggle.findAll('button');
    expect(trajectory!.attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('.trajectory-panel h2').text()).toBe('Your cash trajectory');
    await calendar!.trigger('click');
    expect(calendar!.attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('.trajectory-panel h2').text()).toBe('Your money calendar');
    expect(wrapper.findComponent({name:'CashTrajectory'}).element.parentElement!.hasAttribute('inert')).toBe(true);
    expect(localStorage.getItem('overview-glance')).toBe('calendar');
    wrapper.unmount();
  });
});
