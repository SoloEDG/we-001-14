import type { Battle, Status, StatusKind, Unit } from "../../../shared/types";

export interface StatusRule {
  name: string;
  /** stack：逐层累加；strongest：只取最强一层 */
  merge: "stack" | "strongest";
  amount: number;
}
export const statusRules: Record<StatusKind, StatusRule> = {
  slow: { name: "迟缓", merge: "strongest", amount: 2 },
  burn: { name: "灼烧", merge: "stack", amount: 3 },
  guard: { name: "防御", merge: "strongest", amount: 4 },
};
export const statusKinds = [
  "slow",
  "burn",
  "guard",
] as const satisfies readonly StatusKind[];
export const statusNames = {
  slow: statusRules.slow.name,
  burn: statusRules.burn.name,
  guard: statusRules.guard.name,
};
export const statusDuration = 2;
export const layerId = (kind: StatusKind, source: string | null) =>
  `${kind}:${source ?? "unknown"}`;

const layersOf = (u: Unit, kind: StatusKind) =>
  u.statuses.filter((s) => s.kind === kind);

/**
 * 约定的合并结果：灼烧逐层累加，迟缓与防御只取最强的一层，
 * 避免多层叠加把移动减成负数或护甲无限增长。
 */
export function statusValue(u: Unit, kind: StatusKind) {
  const layers = layersOf(u, kind);
  if (!layers.length) return 0;
  return statusRules[kind].merge === "stack"
    ? layers.reduce((total, s) => total + s.amount, 0)
    : Math.max(...layers.map((s) => s.amount));
}
export function slowPenalty(u: Unit) {
  return statusValue(u, "slow");
}
export function guardBonus(u: Unit) {
  return statusValue(u, "guard");
}
export function burnDamage(u: Unit) {
  return statusValue(u, "burn");
}
export function moveBudget(u: Unit) {
  return Math.max(1, u.move - slowPenalty(u));
}
export function armorValue(u: Unit) {
  return u.armor + guardBonus(u);
}
export interface MergedStatus {
  kind: StatusKind;
  value: number;
  layers: number;
}
export function mergedStatuses(u: Unit): MergedStatus[] {
  return statusKinds
    .map((kind) => ({
      kind,
      value: statusValue(u, kind),
      layers: layersOf(u, kind).length,
    }))
    .filter((s) => s.layers > 0);
}

/**
 * 施加一层状态：同一来源只刷新时长，不新增层；
 * 不同来源各自留层，实际效果由 statusValue 合并。
 */
export function applyStatus(
  u: Unit,
  kind: StatusKind,
  source: string | null,
  turns = statusDuration,
  amount = statusRules[kind].amount,
) {
  const id = layerId(kind, source);
  const existing = u.statuses.find((s) => s.id === id);
  if (existing) {
    existing.turns = Math.max(existing.turns, turns);
    existing.amount = Math.max(existing.amount, amount);
    return existing;
  }
  const layer: Status = { id, kind, source, turns, amount };
  u.statuses.push(layer);
  return layer;
}

/**
 * 结束行动时按层结算：灼烧的各层分别造成伤害，随后每层各自倒计时。
 * 来源角色阵亡不会移除层，效果照常持续到到期。
 */
export function tickStatuses(u: Unit) {
  const damage = burnDamage(u);
  if (damage) u.hp = Math.max(0, u.hp - damage);
  u.statuses = u.statuses
    .map((s) => ({ ...s, turns: s.turns - 1 }))
    .filter((s) => s.turns > 0);
  return damage;
}

/**
 * 旧存档迁移：没有来源信息的旧状态变为“未知来源”的一层。
 * 已带层信息的记录原样保留；同 id 的重复层合并，保证读档/回放跳转幂等。
 */
export function migrateUnit(u: Unit) {
  const raw = Array.isArray(u.statuses) ? u.statuses : [];
  const next = new Map<string, Status>();
  for (const entry of raw as Array<Partial<Status> & { kind: StatusKind }>) {
    const kind = entry?.kind;
    if (!kind || !statusRules[kind]) continue;
    const source = typeof entry.source === "string" ? entry.source : null;
    const id =
      typeof entry.id === "string" && entry.id
        ? entry.id
        : layerId(kind, source);
    const turns = Math.max(0, Math.floor(Number(entry.turns) || 0));
    if (!Number.isFinite(turns) || turns <= 0) continue;
    const rawAmount = Number(entry.amount);
    const amount = Number.isFinite(rawAmount)
      ? Math.max(0, rawAmount)
      : statusRules[kind].amount;
    const existing = next.get(id);
    if (existing) {
      existing.turns = Math.max(existing.turns, turns);
      existing.amount = Math.max(existing.amount, amount);
      continue;
    }
    next.set(id, { id, kind, source, turns, amount });
  }
  u.statuses = [...next.values()];
}
export function migrateBattle(b: Battle) {
  for (const u of b.units) migrateUnit(u);
}
