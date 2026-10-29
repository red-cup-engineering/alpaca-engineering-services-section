import { appFromArguments } from "../src/operator.mjs";
export async function cancelAlpacaOrder(args) { return (await appFromArguments(args)).cancel(args.order); }
