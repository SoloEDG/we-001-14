<script setup lang="ts">
import { computed, ref } from "vue";
import type { Unit } from "../../../shared/types";
import { professions } from "../model/professions";
import { mergedStatuses, statusNames, statusRules } from "../lib/status";
const props = defineProps<{ units: Unit[]; selected: string; active: string }>();
defineEmits<{ select: [id: string] }>();
const open = ref<string | null>(null);
const names = computed(() => {
  const map = new Map<string, string>();
  for (const u of props.units) map.set(u.id, u.name);
  return map;
});
function mergedLabel(u: Unit) {
  return mergedStatuses(u)
    .map(({ kind, value, layers }) => {
      const base = `${statusNames[kind]}${value}`;
      return layers > 1 ? `${base}·${layers}层` : base;
    })
    .join(" ");
}
function sourceName(source: string | null) {
  if (!source) return "未知来源";
  return names.value.get(source) ?? "未知来源";
}
function toggle(id: string) {
  open.value = open.value === id ? null : id;
}
</script>
<template>
  <section class="panel roster-panel">
    <div class="eyebrow">02 / COMBAT SQUAD</div>
    <h3>
      战场编队 <small>{{ units.filter((u) => u.hp > 0).length }} 名存活</small>
    </h3>
    <div
      v-for="u in units"
      :key="u.id"
      :class="['unit-card', u.team, { dead: u.hp <= 0 }]"
    >
      <button
        :data-unit="u.id"
        :class="['unit-row', { chosen: u.id === selected }]"
        @click="$emit('select', u.id)"
      >
        <span class="avatar">{{ u.name.slice(0, 1) }}</span
        ><span class="unit-name"
          ><b>{{ u.name }} <i v-if="u.id === active">行动中</i></b
          ><small
            >{{ professions[u.job].name }} ·
            {{ u.team === "azure" ? "苍蓝" : "余烬" }}</small
          ><span class="hp-track"
            ><i :style="{ width: (u.hp / u.maxHp) * 100 + '%' }" /></span></span
        ><span class="hp-value"
          >{{ u.hp }}<small>/{{ u.maxHp }}</small
          ><small>{{
            mergedLabel(u) || "状态正常"
          }}</small></span
        >
      </button>
      <button
        v-if="u.statuses.length"
        class="status-toggle"
        :aria-expanded="open === u.id"
        :aria-label="`${u.name}的状态层`"
        @click="toggle(u.id)"
      >
        {{ u.statuses.length }} 层 <span>{{ open === u.id ? "▲" : "▼" }}</span>
      </button>
      <ul v-if="open === u.id" class="status-layers">
        <li v-for="s in u.statuses" :key="s.id">
          <b>{{ statusNames[s.kind] }}</b>
          <span
            >{{ statusRules[s.kind].merge === "stack" ? "每层" : "最强" }}
            {{ s.amount }}</span
          ><small
            >{{ sourceName(s.source) }} · 剩余 {{ s.turns }} 次行动</small
          >
        </li>
      </ul>
    </div>
  </section>
</template>
