#!/usr/bin/env node
import { cancelAlpacaOrder } from "../../scripts/cancel-alpaca-order.mjs";
import { pauseAlpacaApp } from "../../scripts/pause-alpaca-app.mjs";
import { resumeAlpacaApp } from "../../scripts/resume-alpaca-app.mjs";
import { revokeAlpacaAuthority } from "../../scripts/revoke-alpaca-authority.mjs";
import { runAlpacaApp } from "../../scripts/run-alpaca-app.mjs";
import { showAlpacaStatus } from "../../scripts/show-alpaca-status.mjs";
import { showAlpacaCapabilities } from "../../scripts/show-alpaca-capabilities.mjs";
import { parseOperatorArguments } from "../../src/operator.mjs";

const operations = { run: runAlpacaApp, status: showAlpacaStatus, capabilities: showAlpacaCapabilities, pause: pauseAlpacaApp, resume: resumeAlpacaApp, revoke: revokeAlpacaAuthority, cancel: cancelAlpacaOrder };
const args = parseOperatorArguments(process.argv.slice(2));
if (!operations[args.command]) throw new TypeError(`unknown-command:${args.command}`);
const result = await operations[args.command](args);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
