import { appFromArguments } from "../src/operator.mjs";

export async function pauseAlpacaApp(args) {
  return (await appFromArguments(args)).pause(args.reason);
}
