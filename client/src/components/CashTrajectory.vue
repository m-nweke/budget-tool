<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Forecast } from '../finance/types';
const props=defineProps<{forecast:Forecast; scenario?:Forecast|null; compact?:boolean; cushion:number}>();
const selected=ref(0);
const money=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v/100);
const selectedDay=computed(()=>props.forecast.daily[Math.min(selected.value,props.forecast.daily.length-1)]);
const range=computed(()=>{const v=[...props.forecast.daily,...(props.scenario?.daily??[])].map(d=>d.balance_cents);return {min:Math.min(0,...v),max:Math.max(props.cushion*1.5,...v)*1.12}});
function y(v:number){return 225-(v-range.value.min)/(range.value.max-range.value.min||1)*200}
const path=computed(()=>props.forecast.daily.map((d,i)=>`${i?'L':'M'}${i/(props.forecast.daily.length-1||1)*900},${y(d.balance_cents)}`).join(' '));
const scenarioPath=computed(()=>props.scenario?.daily.map((d,i)=>`${i?'L':'M'}${i/((props.scenario?.daily.length??1)-1||1)*900},${y(d.balance_cents)}`).join(' '));
const x=computed(()=>selected.value/(props.forecast.daily.length-1||1)*900);
function scrub(e:PointerEvent){const target=e.currentTarget as SVGElement; const box=target.getBoundingClientRect();selected.value=Math.max(0,Math.min(props.forecast.daily.length-1,Math.round((e.clientX-box.left)/box.width*(props.forecast.daily.length-1))));}
</script>
<template>
 <div class="trajectory" v-if="selectedDay">
  <div class="trajectory-readout"><div><span class="subtle">{{ new Date(selectedDay.date+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric'}) }} · projected cash</span><strong>{{ money(scenario?.daily[selected]?.balance_cents ?? selectedDay.balance_cents) }}</strong></div><span class="chart-key"><i /> Cash balance <i class="amber" /> Cushion <template v-if="scenario"><i class="scenario-dot" /> What-if</template></span></div>
  <svg class="trajectory-svg" viewBox="0 0 900 250" preserveAspectRatio="none" role="img" aria-label="90-day projected cash balance. Use the slider below to explore each day." @pointermove="scrub" @pointerdown="scrub">
   <defs><linearGradient id="cash-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--color-primary)" stop-opacity=".22"/><stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0"/></linearGradient></defs>
   <line v-for="n in 4" :key="n" x1="0" :y1="n*55" x2="900" :y2="n*55" class="chart-grid" />
   <path :d="path+' L900,250 L0,250 Z'" fill="url(#cash-fill)" />
   <line x1="0" :y1="y(cushion)" x2="900" :y2="y(cushion)" class="cushion-line" />
   <path :d="path" class="cash-line" />
   <path v-if="scenarioPath" :d="scenarioPath" class="scenario-line" />
   <line :x1="x" y1="0" :x2="x" y2="250" class="scrub-line" />
   <circle :cx="x" :cy="y(selectedDay.balance_cents)" r="5" class="scrub-dot" />
  </svg>
  <input class="chart-slider" type="range" min="0" :max="forecast.daily.length-1" v-model.number="selected" aria-label="Explore forecast day" />
  <div class="chart-dates"><span>{{ new Date(forecast.from+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) }}</span><span>30 days</span><span>60 days</span><span>90 days</span></div>
 </div>
</template>
