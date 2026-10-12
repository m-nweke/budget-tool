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
});
