// The Worker's entry (wrangler.jsonc "main"): the public read API (worker.js) and the registry entrypoint (rpc.js) that
// the games call through a service binding. They're joined here so the tests can load worker.js without the
// Cloudflare-only module that rpc.js needs.
export { default } from "./worker.js";
export { Registry, Accounts } from "./rpc.js";
