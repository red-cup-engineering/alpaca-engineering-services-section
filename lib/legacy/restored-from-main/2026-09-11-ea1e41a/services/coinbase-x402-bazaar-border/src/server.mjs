import { resolve } from "node:path";
import { createWebApplicationEngine } from "@red-cup-engineering/web-server-services-section/web-application-engine";
import { startWebServer } from "@red-cup-engineering/web-server-services-section/node";
import { createExactEvmFetchPaymentBoundary, declareDiscoveryExtension } from "@red-cup-engineering/x402-services-section/fetch";
import {
  CDP_FACILITATOR_URL,
  createCdpFacilitatorClient,
} from "@red-cup-engineering/x402-services-section/cdp-facilitator";
import { createSemanticRecordJournal } from "@red-cup-engineering/semantic-record-journal-service";
import { assertNoCommercialCredentials } from "./http-border.mjs";
import { createBrokerageOutcomeWitnessRecorder, createBrokerageX402SettlementWitness } from "./settlement-witness.mjs";
import { canonicalJson as canonical } from "@red-cup-engineering/canonical-json-service";

export const ROUTES = Object.freeze({
  issuer: "/v1/issuer-evidence", alpha: "/v1/aggressive-alpha", paperIntent: "/v1/paper-intent", reconcile: "/v1/reconcile",
  divinationReading: "/v1/divination/daily-reading", reportGraphic: "/v1/report-graphics/render", occupationEntropy: "/v1/occupation-entropy",
  strategySynthesis: "/v1/strategies/synthesize",
});
export const PRICES = Object.freeze({ issuer: "$0.25", alpha: "$1.00", paperIntent: "$2.00", reconcile: "$0.50", divinationReading: "$0.08", reportGraphic: "$0.12", occupationEntropy: "$0.01", strategySynthesis: "$15.00" });
export const CATALOG_ROUTE = "/.well-known/brokerage-products";
export const CDP_FACILITATOR_SELECTION = Object.freeze({
  provider: "cdp",
  urlMarker: "api.cdp.coinbase.com",
  correlation: Object.freeze({ sdkLanguage: "javascript", source: "coinbase-x402-bazaar-border", sourceVersion: "0.1.7" }),
});
const DEFAULT_NETWORK = "eip155:8453", DEFAULT_FACILITATOR = "https://api.cdp.coinbase.com/platform/v2/x402", DEFAULT_PORT = 4022;
const inputSchema = { properties: { request: { type: "object", description: "Product-specific request; brokerage credentials are refused." } }, required: ["request"] };
const DISCOVERY_TIME = "2026-01-01T00:00:00.000Z";
const DISCOVERY_SOURCE = Object.freeze({ uri: "https://www.sec.gov/Archives/edgar/data/example", observedAt: DISCOVERY_TIME, digest: "sha256:public-example-source" });
const DISCOVERY_EVIDENCE = Object.freeze({ type: "IssuerEvidencePacket", id: "sha256:public-example-evidence" });
const DISCOVERY_CONTRACT = Object.freeze({ type: "PrincipalBrokerageServiceContract", id: "urn:example:discovery-contract", scopes: Object.freeze(["orders:intent"]), capital: Object.freeze({ amount: 100, currency: "USD" }), risk: Object.freeze({ maximumOrderNotional: 100, maximumLossAmount: 100, concentrationLimit: 1 }) });
export const BAZAAR_DISCOVERY_REQUESTS = Object.freeze({
  issuer: Object.freeze({ ticker: "AAPL", issuer: "Apple Inc.", asOf: DISCOVERY_TIME, sources: Object.freeze([DISCOVERY_SOURCE]), claims: Object.freeze([{ statement: "Public example claim for API discovery only.", sourceDigests: Object.freeze([DISCOVERY_SOURCE.digest]) }]) }),
  alpha: Object.freeze({ contract: DISCOVERY_CONTRACT, evidencePackets: Object.freeze([DISCOVERY_EVIDENCE]), symbol: "AAPL", notional: 1, maximumLoss: 1, thesis: "Public discovery example only.", falsifier: "Public discovery example only.", liquidityPremise: "Public discovery example only.", executionPremise: "Public discovery example only.", scenarios: Object.freeze([{ pnl: -1 }, { pnl: 1 }]) }),
  paperIntent: Object.freeze({ contract: DISCOVERY_CONTRACT, evidencePackets: Object.freeze([DISCOVERY_EVIDENCE]), symbol: "AAPL", notional: 1, maximumLoss: 1, thesis: "Public discovery example only.", falsifier: "Public discovery example only.", liquidityPremise: "Public discovery example only.", executionPremise: "Public discovery example only.", scenarios: Object.freeze([{ pnl: -1 }, { pnl: 1 }]) }),
  reconcile: Object.freeze({ expected: Object.freeze({ accountReference: "urn:example:discovery-account", observedAt: DISCOVERY_TIME, source: DISCOVERY_SOURCE, account: Object.freeze({ cash: "100", equity: "100", buying_power: "100" }) }), observed: Object.freeze({ accountReference: "urn:example:discovery-account", observedAt: DISCOVERY_TIME, source: DISCOVERY_SOURCE, account: Object.freeze({ cash: "100", equity: "100", buying_power: "100" }) }) }),
  divinationReading: Object.freeze({ date: "2026-01-01", tradition: "rcl" }),
  reportGraphic: Object.freeze({ packet: Object.freeze({ type: "HarmoniousUnionDeltaPacket", period: "discovery-example", subscriptionDigest: "sha256:public-example-subscription", previousSuccessfulPublicationDigest: null, currentManifestDigest: "sha256:public-example-manifest", claims: Object.freeze([]) }) }),
  occupationEntropy: Object.freeze({ occupation: Object.freeze([1, 1]) }),
  strategySynthesis: Object.freeze({ customerActor: "urn:example:customer", contextProduct: "ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", incumbentProgram: "ni:///sha-256;BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", acceptanceSuite: "ni:///sha-256;CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", abi: "export function decide(input) -> plain JSON target scores or weights", populationSize: 1, maxTokensPerCandidate: 512, maximumWallClockMs: 60000, evidenceFacts: Object.freeze(["Public discovery example only."]), allowedFeatureDependencies: Object.freeze(["momentum"]), failureHistory: Object.freeze([]), generation: 0 }),
});

const isDeclaredBazaarDiscoveryProbe = (key, request) => canonical(request) === canonical(BAZAAR_DISCOVERY_REQUESTS[key]);
const discovery = (key, name, description) => declareDiscoveryExtension({ method: "POST", bodyType: "json", input: { request: BAZAAR_DISCOVERY_REQUESTS[key] }, inputSchema, output: { schema: { type: "object", required: ["id", "type"], properties: { id: { type: "string" }, type: { type: "string" } } }, example: { id: "sha256:content-addressed", type: name, description } } });
function selectedFacilitator(env, client, url) { if (client) return client; if (env.X402_FACILITATOR_PROVIDER === CDP_FACILITATOR_SELECTION.provider || url === CDP_FACILITATOR_URL || url.includes(CDP_FACILITATOR_SELECTION.urlMarker)) return createCdpFacilitatorClient({ apiKeyId: env.CDP_API_KEY_ID, apiKeySecret: env.CDP_API_KEY_SECRET, baseUrl: url, correlation: CDP_FACILITATOR_SELECTION.correlation }); return undefined; }
function routeTable(network, payTo) {
  const row = (key, path, price, name, description, tags) => ({ accepts: { scheme: "exact", price, network, payTo }, description, mimeType: "application/json", serviceName: name, tags, extensions: discovery(key, name, description) });
  return {
    [`POST ${ROUTES.issuer}`]: row("issuer", ROUTES.issuer, PRICES.issuer, "brokerage-issuer-evidence", "Dated source-grounded public-company evidence packet.", ["stocks", "issuer-research", "evidence"]),
    [`POST ${ROUTES.alpha}`]: row("alpha", ROUTES.alpha, PRICES.alpha, "brokerage-aggressive-alpha", "Evidence, falsifier, liquidity, execution, and scenario-aware aggressive alpha packet.", ["alpha", "portfolio", "risk"]),
    [`POST ${ROUTES.paperIntent}`]: row("paperIntent", ROUTES.paperIntent, PRICES.paperIntent, "brokerage-paper-intent", "Mandate-bound paper portfolio and typed order intent with no venue effect.", ["portfolio", "order-intent", "paper"]),
    [`POST ${ROUTES.reconcile}`]: row("reconcile", ROUTES.reconcile, PRICES.reconcile, "brokerage-account-reconciliation", "Normalize and reconcile customer-supplied Alpaca account evidence.", ["alpaca", "account-data", "reconciliation"]),
    [`POST ${ROUTES.divinationReading}`]: row("divinationReading", ROUTES.divinationReading, PRICES.divinationReading, "divination-daily-reading", "One canonical RMN daily reading (lectionary plus astrology) hired from Divination's own sovereign settlement service, witnessed.", ["divination", "astrology", "lectionary", "daily-reading"]),
    [`POST ${ROUTES.reportGraphic}`]: row("reportGraphic", ROUTES.reportGraphic, PRICES.reportGraphic, "deterministic-report-graphic", "Renders one explicit FOUR-valued HarmoniousUnionDeltaPacket into byte-stable SVG and PNG artifacts.", ["report-graphics", "svg", "png", "deterministic"]),
    [`POST ${ROUTES.occupationEntropy}`]: row("occupationEntropy", ROUTES.occupationEntropy, PRICES.occupationEntropy, "obsmetrologia-occupation-entropy-readout", "Boltzmann occupation-entropy readout (cells, totalObjects, configH, entropyBits) of a supplied occupation list, hired from the occupation-entropy-readout die.", ["obsmetrologia", "entropy", "occupation", "boltzmann"]),
    [`POST ${ROUTES.strategySynthesis}`]: row("strategySynthesis", ROUTES.strategySynthesis, PRICES.strategySynthesis, "brokerage-strategy-program-foundry", "Provider-distinct, independently static-assayed strategy population with explicit falsifiers, bounded inference budgets, and no venue effect.", ["strategy", "synthesis", "static-assay", "agentic", "falsifiers", "a2a"]),
  };
}

const providerAvailable = (provider) => typeof provider === "function" && typeof provider.preflight === "function"
  && typeof provider.originatingActor === "string" && typeof provider.externalEvidence === "function";
function publicCatalog(network, providers) {
  return Object.freeze({
    type: "BrokerageProductCatalog", version: 1, settlement: { protocol: "x402", version: 2, network },
    indexingClaim: "none-until-successful-CDP-settlement",
    products: Object.entries(ROUTES).map(([key, path]) => Object.freeze({
      key, method: "POST", path, price: PRICES[key], asset: "USDC", available: providerAvailable(providers[key]),
    })),
  });
}

function pricedResource(key, path, providers, payment, recordDelivery) {
  return {
    match: path,
    methods: ["POST"],
    async handler(context) {
      const body = await context.input.json();
      try {
        if (!body || typeof body.request !== "object") throw new TypeError("request-object-required");
        assertNoCommercialCredentials(body);
      } catch (error) {
        return Response.json({ error: "product-preflight-refused", reason: error.message }, { status: 422 });
      }
      if (!providerAvailable(providers[key])) return Response.json({ error: "product-provider-unavailable", product: key }, { status: 503 });
      try {
        if (!isDeclaredBazaarDiscoveryProbe(key, body.request)) await providers[key].preflight(body.request);
      } catch (error) {
        return Response.json({ error: "product-preflight-refused", reason: error.message }, { status: 422 });
      }
      return payment().handle(context.request, async () => {
        const provider = providers[key];
        try {
          const output = await provider(body.request);
          const recorded = await recordDelivery({
            originatingActor: provider.originatingActor, inputs: [body.request], output,
            externalEvidence: provider.externalEvidence(body.request, output),
          });
          return Response.json({ output, witness: recorded.witness ?? recorded });
        } catch (error) {
          return Response.json({ error: "paid-product-delivery-or-witness-failed", reason: error.message }, { status: 503 });
        }
      });
    },
  };
}

export function createBrokerageX402Server(env = process.env, dependencies = {}) {
  const network = env.X402_NETWORK || DEFAULT_NETWORK, facilitatorUrl = env.X402_FACILITATOR || DEFAULT_FACILITATOR, payTo = env.X402_PAY_TO;
  if (!payTo) throw new Error("X402_PAY_TO is required; provider payout identity has no default");
  const facilitatorClient = selectedFacilitator(env, dependencies.facilitatorClient, facilitatorUrl);
  const afterSettle = dependencies.afterSettle || createBrokerageX402SettlementWitness(env);
  const recordDelivery = dependencies.recordDelivery || createBrokerageOutcomeWitnessRecorder(env);
  const providers = dependencies.providers;
  if (!providers || typeof providers !== "object") throw new TypeError("brokerage-product-providers-required");
  const catalog = publicCatalog(network, providers);

  // Built lazily, once, on first use — matches the Express version's single `payment` boundary
  // instance, just deferred past module evaluation to keep this function side-effect-free to call.
  let boundary;
  const payment = () => boundary ??= createExactEvmFetchPaymentBoundary({ network, facilitatorUrl, facilitatorClient, routes: routeTable(network, payTo), afterSettle });

  const engine = createWebApplicationEngine({
    onError: (error) => Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }),
    resources: [
      {
        match: "/healthz", methods: ["GET"],
        handler: () => Response.json({
          status: "ok", service: "coinbase-x402-bazaar-border", network,
          offers: catalog.products.length, availableOffers: catalog.products.filter((product) => product.available).length,
        }),
      },
      { match: CATALOG_ROUTE, methods: ["GET"], handler: () => Response.json(catalog) },
      ...Object.entries(ROUTES).map(([key, path]) => pricedResource(key, path, providers, payment, recordDelivery)),
    ],
  });

  return Object.freeze({ engine, fetch: engine.fetch, network, facilitatorUrl, payTo, routes: ROUTES, prices: PRICES, catalog, port: Number(env.PORT) || DEFAULT_PORT });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { createDefaultProviders, selectEnabledProviders } = await import("./product-providers.mjs");
  const enabledKeys = process.env.BROKERAGE_X402_ENABLED_PRODUCTS
    ? process.env.BROKERAGE_X402_ENABLED_PRODUCTS.split(",").map((key) => key.trim()).filter(Boolean)
    : undefined;
  const providers = selectEnabledProviders(createDefaultProviders(process.env), enabledKeys);
  const server = createBrokerageX402Server(process.env, { providers });
  const { port: resolvedPort } = await startWebServer(server.engine, { port: server.port, host: "0.0.0.0", trustProxy: 1 });
  if (process.env.BROKERAGE_X402_DATA_ROOT) {
    const journal = createSemanticRecordJournal({ root: resolve(process.env.BROKERAGE_X402_DATA_ROOT), objectKind: "brokerage.coinbase-x402-bazaar-border.server-event" });
    journal.record({
      category: "brokerage.coinbase-x402-bazaar.listening",
      recordedAt: new Date().toISOString(),
      record: { port: resolvedPort, network: server.network, payTo: server.payTo, facilitatorUrl: server.facilitatorUrl, offers: server.catalog.products.length },
      charge: { support: true, refutation: false },
    });
  }
  console.log(`brokerage x402 border listening on 0.0.0.0:${resolvedPort} (${server.network})`);
}
