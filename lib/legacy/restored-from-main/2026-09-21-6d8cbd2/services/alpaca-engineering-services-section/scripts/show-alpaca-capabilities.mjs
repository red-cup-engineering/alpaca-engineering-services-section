import { describeAlpacaAppProduct } from "../src/product.mjs";
import { runJavascriptNodeOperation } from "../../../../../../../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

export async function showAlpacaCapabilities() {
  return describeAlpacaAppProduct();
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "show-alpaca-capabilities", description: "showAlpacaCapabilities — the show-alpaca-capabilities operation.", operation: showAlpacaCapabilities }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
