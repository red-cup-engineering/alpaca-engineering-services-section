import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAlpacaApp } from "./alpaca-app.mjs";
import { createAlpacaAppFileState } from "./file-state.mjs";

const path = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label}-required`);
  return isAbsolute(value) ? value : resolve(value);
};

export async function loadAlpacaApp({ configPath, adapterModulePath, strategyModulePath }) {
  const configuration = JSON.parse(readFileSync(path(configPath, "config-path"), "utf8"));
  const adapterModule = await import(pathToFileURL(path(adapterModulePath, "adapter-module-path")));
  const strategyModule = await import(pathToFileURL(path(strategyModulePath, "strategy-module-path")));
  if (typeof adapterModule.createAdapter !== "function" || (typeof strategyModule.createStrategy !== "function" && typeof strategyModule.strategy !== "function")) throw new TypeError("adapter-and-strategy-factory-exports-required");
  const adapter = await adapterModule.createAdapter(configuration);
  const strategy = typeof strategyModule.createStrategy === "function" ? await strategyModule.createStrategy(configuration) : strategyModule.strategy;
  const statePath = path(configuration.statePath, "state-path");
  const state = createAlpacaAppFileState(statePath);
  const recordOutcome = typeof adapter.recordOutcome === "function" ? adapter.recordOutcome : typeof adapterModule.recordOutcome === "function" ? adapterModule.recordOutcome : async () => null;
  return createAlpacaApp({ configuration, adapter, strategy, state, recordOutcome });
}

export function parseOperatorArguments(argv) {
  const values = { command: argv[0] ?? "status" };
  for (let index = 1; index < argv.length; index += 2) {
    const name = argv[index], value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new TypeError("operator-arguments-invalid");
    values[name.slice(2)] = value;
  }
  return Object.freeze(values);
}

export async function appFromArguments(args) {
  return loadAlpacaApp({ configPath: args.config,
    adapterModulePath: args.adapter ?? fileURLToPath(new URL("./alpaca-production-adapter.mjs", import.meta.url)),
    strategyModulePath: args.strategy ?? fileURLToPath(new URL("./blk-strategy.mjs", import.meta.url)) });
}
