<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { endTour, tour, tourSteps } from '../finance/tour';
import FinanceIcon from './FinanceIcon.vue';

/** Non-modal walkthrough: spotlights one panel at a time and leaves the page usable underneath. */
const props = defineProps<{ demo: boolean }>();
const route = useRoute(), router = useRouter();
const step = computed(() => tourSteps[tour.index]!);
const last = computed(() => tour.index === tourSteps.length - 1);
const rect = ref<DOMRect | null>(null);
const card = ref<HTMLElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
let target: HTMLElement | null = null, returnFocus: HTMLElement | null = null, frame = 0, run = 0;

const pathFor = (section: string) => props.demo ? `/demo/${section}` : section === 'overview' ? '/' : `/${section}`;
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

async function findTarget(selector: string, attempt: number) {
  for (let waited = 0; waited < 3000; waited += 50) {
    if (attempt !== run) return null;
    const found = document.querySelector<HTMLElement>(selector);
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return null;
}
function measure() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    viewport.value = { width: window.innerWidth, height: window.innerHeight };
    rect.value = target?.isConnected ? target.getBoundingClientRect() : null;
  });
}
async function show() {
  const attempt = ++run;
  target = null; rect.value = null;
  if (route.path !== pathFor(step.value.section)) await router.push(pathFor(step.value.section));
  target = await findTarget(step.value.target, attempt);
  if (attempt !== run) return;
  if (target) {
    const tall = target.offsetHeight > window.innerHeight * 0.6;
    target.scrollIntoView({ block: tall ? 'start' : 'center', behavior: reduced() ? 'auto' : 'smooth' });
  }
  measure();
  await nextTick(); heading.value?.focus({ preventScroll: true });
}

const PAD = 8, GAP = 14;
const spotlight = computed(() => rect.value && {
  top: `${rect.value.top - PAD}px`, left: `${rect.value.left - PAD}px`,
  width: `${rect.value.width + PAD * 2}px`, height: `${rect.value.height + PAD * 2}px`,
});
/** Phones dock the card above the bottom navigation; wider screens try below, above, then beside the panel before a corner. */
const placement = computed((): Record<string, string> => {
  const { width, height } = viewport.value;
  if (width < 700) return { left: '16px', right: '16px', bottom: '84px' };
  const cardHeight = card.value?.offsetHeight ?? 220, cardWidth = Math.min(360, width - 32);
  const r = rect.value;
  if (!r) return { left: `${(width - cardWidth) / 2}px`, top: `${Math.max(16, (height - cardHeight) / 2)}px`, width: `${cardWidth}px` };
  const left = `${Math.min(Math.max(16, r.left), width - cardWidth - 16)}px`;
  if (r.bottom + PAD + GAP + cardHeight < height) return { left, top: `${r.bottom + PAD + GAP}px`, width: `${cardWidth}px` };
  if (r.top - PAD - GAP - cardHeight > 0) return { left, top: `${r.top - PAD - GAP - cardHeight}px`, width: `${cardWidth}px` };
  const top = `${Math.min(Math.max(16, r.top), height - cardHeight - 16)}px`;
  if (width - r.right - PAD - GAP - cardWidth > 16) return { left: `${r.right + PAD + GAP}px`, top, width: `${cardWidth}px` };
  if (r.left - PAD - GAP - cardWidth > 16) return { left: `${r.left - PAD - GAP - cardWidth}px`, top, width: `${cardWidth}px` };
  return { right: '24px', bottom: '24px', width: `${cardWidth}px` };
});

function next() { if (last.value) finish(); else tour.index++; }
function back() { if (tour.index > 0) tour.index--; }
function finish() { endTour(); }
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); finish(); } }

watch(() => tour.active, active => {
  if (active) {
    returnFocus = document.activeElement as HTMLElement | null;
    window.addEventListener('keydown', onKey); window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    void show();
  } else {
    run++; target = null; rect.value = null;
    window.removeEventListener('keydown', onKey); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true);
    returnFocus?.focus?.({ preventScroll: true });
  }
}, { immediate: true });
watch(() => tour.index, () => { if (tour.active) void show(); });
onBeforeUnmount(() => { if (tour.active) { run++; window.removeEventListener('keydown', onKey); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); } cancelAnimationFrame(frame); });
</script>

<template>
  <div v-if="tour.active" class="finance-tour">
    <div v-if="spotlight" class="tour-spotlight" :style="spotlight" aria-hidden="true" />
    <div v-else class="tour-scrim" aria-hidden="true" />
    <section ref="card" class="tour-card" :style="placement" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body">
      <p class="tour-progress"><span>{{ demo ? 'Demo tour' : 'Quick tour' }}</span><span>Step {{ tour.index + 1 }} of {{ tourSteps.length }}</span></p>
      <h2 id="tour-title" ref="heading" tabindex="-1">{{ step.title }}</h2>
      <p id="tour-body">{{ step.body }}</p>
      <div class="tour-dots" aria-hidden="true"><i v-for="(s, i) in tourSteps" :key="s.title" :class="{ current: i === tour.index }" /></div>
      <div class="tour-actions">
        <button type="button" class="text-button" @click="finish">Skip tour</button>
        <span>
          <button v-if="tour.index > 0" type="button" class="btn btn-secondary" @click="back">Back</button>
          <button type="button" class="btn btn-primary" @click="next">{{ last ? 'Finish' : 'Next' }} <FinanceIcon v-if="!last" name="arrow" /></button>
        </span>
      </div>
    </section>
  </div>
</template>
