import { appFromArguments } from "../src/operator.mjs";
export async function revokeAlpacaAuthority(args) { return (await appFromArguments(args)).revoke(args.reason); }
