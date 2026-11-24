using Workerd = import "/workerd/workerd.capnp";
const tests :Workerd.Config = (services = [(name = "main", worker = .driver), (name = "internet", network = (allow = []))]);
const driver :Workerd.Worker = (modules = [(name = "worker", esModule = embed "worker.mjs")], compatibilityDate = "2026-09-01", compatibilityFlags = ["nodejs_compat"]);
