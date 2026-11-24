using Workerd = import "/workerd/workerd.capnp";
const tests :Workerd.Config = (services = [(name = "main", worker = .driver), (name = "internet", network = (allow = []))]);
const driver :Workerd.Worker = (modules = [(name = "worker", esModule = embed "worker.mjs"), (name = "aapl-source", text = embed "../../../logs/procurement-logs/2026-10-24-kernel-receiving/AAPL.companyfacts.json"), (name = "msft-source", text = embed "../../../logs/procurement-logs/2026-10-24-kernel-receiving/MSFT.companyfacts.json")], compatibilityDate = "2026-09-01", compatibilityFlags = ["nodejs_compat"]);
