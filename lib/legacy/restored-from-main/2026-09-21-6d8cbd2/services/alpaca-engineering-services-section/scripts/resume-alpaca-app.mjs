import { appFromArguments } from "../src/operator.mjs";
export async function resumeAlpacaApp(args) { return (await appFromArguments(args)).resume(); }
