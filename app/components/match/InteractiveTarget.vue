<template>
  <div class="target-wrap">
    <svg viewBox="0 0 420 420" class="target-board" role="img" aria-label="Interactive darts target">
      <circle cx="210" cy="210" r="196" class="board-bg" />

      <g v-for="(sector, index) in sectors" :key="`single-outer-${sector.value}`">
        <path
          :d="ringSegmentPath(sector.start, sector.end, 126, 170)"
          :class="singleClass(index)"
          @click="emitHit(sector.value, 1)"
        />
        <path
          :d="ringSegmentPath(sector.start, sector.end, 170, 188)"
          :class="doubleTripleClass(index)"
          @click="emitHit(sector.value, 2)"
        />
        <path
          :d="ringSegmentPath(sector.start, sector.end, 32, 110)"
          :class="singleClass(index)"
          @click="emitHit(sector.value, 1)"
        />
        <path
          :d="ringSegmentPath(sector.start, sector.end, 110, 126)"
          :class="doubleTripleClass(index)"
          @click="emitHit(sector.value, 3)"
        />

        <text
          :x="labelPoint(sector.middle, 200).x"
          :y="labelPoint(sector.middle, 200).y"
          class="segment-label"
        >
          {{ sector.value }}
        </text>

        <line
          :x1="linePoint(sector.start, 32).x"
          :y1="linePoint(sector.start, 32).y"
          :x2="linePoint(sector.start, 188).x"
          :y2="linePoint(sector.start, 188).y"
          class="segment-divider"
        />
      </g>

      <circle cx="210" cy="210" r="32" class="ring-bull-outer" @click="emitHit(25, 1)" />
      <circle cx="210" cy="210" r="15" class="ring-bull-inner" @click="emitHit(25, 2)" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import type { Multiplier, Segment } from '~~/shared/types/darts'

const emit = defineEmits<{
  hit: [payload: { segment: Segment, multiplier: Multiplier }]
}>()

const order: Segment[] = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
const startAngle = -99
const step = 18

const sectors = order.map((value, index) => {
  const start = startAngle + (index * step)
  const end = start + step
  return {
    value,
    start,
    end,
    middle: start + (step / 2)
  }
})

function polar(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180
  return {
    x: 210 + (Math.cos(radians) * radius),
    y: 210 + (Math.sin(radians) * radius)
  }
}

function ringSegmentPath(start: number, end: number, innerR: number, outerR: number) {
  const p1 = polar(start, outerR)
  const p2 = polar(end, outerR)
  const p3 = polar(end, innerR)
  const p4 = polar(start, innerR)
  const largeArc = end - start > 180 ? 1 : 0

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z'
  ].join(' ')
}

function labelPoint(angle: number, radius: number) {
  return polar(angle, radius)
}

function linePoint(angle: number, radius: number) {
  return polar(angle, radius)
}

function emitHit(segment: Segment, multiplier: Multiplier) {
  emit('hit', { segment, multiplier })
}

function singleClass(index: number) {
  return index % 2 === 0 ? 'ring-single-black' : 'ring-single-white'
}

function doubleTripleClass(index: number) {
  return index % 2 === 0 ? 'ring-accent-red' : 'ring-accent-green'
}
</script>

<style scoped>
.target-wrap {
  width: min(100%, 460px);
  margin: 0 auto;
  padding: 0.35rem;
  border-radius: 16px;
  background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.1));
}

.target-board {
  width: 100%;
  height: auto;
}

.board-bg {
  fill: #091525;
  stroke: rgba(255, 255, 255, 0.22);
  stroke-width: 1;
}

.ring-single-black,
.ring-single-white,
.ring-accent-red,
.ring-accent-green,
.ring-bull-outer,
.ring-bull-inner {
  cursor: pointer;
  transition: filter 120ms ease, stroke 120ms ease, stroke-width 120ms ease;
  stroke-linejoin: round;
}

.ring-single-black {
  fill: #121820;
  stroke: rgba(255, 255, 255, 0.16);
  stroke-width: 0.5;
}

.ring-single-white {
  fill: #eceff3;
  stroke: rgba(0, 0, 0, 0.2);
  stroke-width: 0.5;
}

.ring-accent-red,
.ring-bull-outer {
  fill: #c83241;
}

.ring-accent-green {
  fill: #2ea56e;
}

.ring-bull-inner {
  fill: #2ea56e;
}

.ring-single-black:hover,
.ring-single-white:hover,
.ring-accent-red:hover,
.ring-accent-green:hover,
.ring-bull-outer:hover,
.ring-bull-inner:hover {
  filter: brightness(1.22);
}

.ring-single-black:hover,
.ring-single-white:hover {
  stroke: #ffd166;
  stroke-width: 2.4;
}

.ring-accent-red:hover,
.ring-accent-green:hover,
.ring-bull-outer:hover,
.ring-bull-inner:hover {
  stroke: #ffd166;
  stroke-width: 1.6;
}

.segment-label {
  fill: #f4f7fb;
  font-size: 12px;
  text-anchor: middle;
  dominant-baseline: middle;
  font-weight: 700;
  pointer-events: none;
}

.segment-divider {
  stroke: rgba(0, 0, 0, 0.28);
  stroke-width: 0.7;
  pointer-events: none;
}
</style>
