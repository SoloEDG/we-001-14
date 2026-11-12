import type { Session } from "../../../shared/types";
import { assertBattle } from "../../../shared/document";
import { migrateBattle } from "../../roster/lib/status";
export function saveArchive(s: Session) {
  localStorage.setItem("we001-session", JSON.stringify(s));
}
export function loadArchive(): Session | null {
  try {
    const raw = localStorage.getItem("we001-session");
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    assertBattle(s.live);
    assertBattle(s.initial);
    if (!Array.isArray(s.events)) return null;
    migrateSession(s);
    return s;
  } catch {
    return null;
  }
}
/**
 * 旧存档迁移，幂等：实时战况、初始战况与每条回放帧的旧状态
 * 都变成“未知来源”的一层；重复调用不会叠加层数。
 */
export function migrateSession(s: Session) {
  migrateBattle(s.initial);
  migrateBattle(s.live);
  for (const e of s.events) {
    migrateBattle(e.before);
    migrateBattle(e.after);
  }
  return s;
}
export function downloadArchive(s: Session) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "灰烬渡口-战斗记录.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
