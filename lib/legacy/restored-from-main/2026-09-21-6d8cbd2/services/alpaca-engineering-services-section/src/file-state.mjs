import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function createAlpacaAppFileState(path) {
  if (typeof path !== "string" || !path.trim()) throw new TypeError("alpaca-app-state-path-required");
  const statePath = resolve(path);
  return Object.freeze({
    load() {
      try { return JSON.parse(readFileSync(statePath, "utf8")); }
      catch (error) { if (error?.code === "ENOENT") return {}; throw error; }
    },
    save(state) {
      mkdirSync(dirname(statePath), { recursive: true });
      const temporary = `${statePath}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, statePath);
      return state;
    },
  });
}
