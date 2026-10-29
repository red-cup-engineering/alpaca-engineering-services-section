import { appFromArguments } from "../src/operator.mjs";
export async function showAlpacaStatus(args) { return (await appFromArguments(args)).status(); }
