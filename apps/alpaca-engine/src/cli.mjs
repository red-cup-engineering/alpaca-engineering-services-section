#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { openProductionAlpacaBrokerage } from './runtime.mjs';

const usage = 'Usage: alpaca-engine --state-root PATH --custody-root PATH (--mandate REFERENCE | --bind-person GOOGLE_SUBJECT --contract REFERENCE --authority-grant REFERENCE)';

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      'state-root': { type: 'string' },
      'custody-root': { type: 'string' },
      mandate: { type: 'string' },
      'bind-person': { type: 'string' },
      contract: { type: 'string' },
      'authority-grant': { type: 'string' },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  if (!values['state-root'] || !values['custody-root']
    || Boolean(values.mandate?.trim()) === Boolean(values['bind-person']?.trim())
    || (values['bind-person'] && (!values.contract?.trim() || !values['authority-grant']?.trim()))
    || (values.mandate && (values.contract || values['authority-grant']))) {
    throw new TypeError(usage);
  }

  const brokerage = openProductionAlpacaBrokerage({
    stateRoot: values['state-root'],
    custodyRoot: values['custody-root'],
  });
  const result = values['bind-person'] ? await brokerage.bindAssistPerson({ personSubject: values['bind-person'],
    contractReference: values.contract, authorityGrantReference: values['authority-grant'] })
    : await brokerage.runMandatedPortfolio({ mandateReference: values.mandate });
  console.log(JSON.stringify(result));
}

main().catch(error => {
  console.error(error.code === 'ENOENT' ? 'A required Alpaca engine record is missing.' : error.message);
  process.exitCode = 1;
});
