import { appFromArguments } from "../src/operator.mjs";
export async function runAlpacaApp(args) { return (await appFromArguments(args)).run(); }
