# Alpaca ASSIST

This application uses the shared ASSIST authentication, session, chat and MCP
implementation and `@red-cup-engineering/alpaca-engine` for brokerage operations.
The financial fleet uses that same engine. There is no browser credential store
or separate ASSIST trading implementation.

The hosted factory takes one canonical tenant and explicit environment bindings.
`ASSIST_OWNER_EMAIL` and comma- or space-separated `ASSIST_MEMBER_EMAILS` select
who can sign in. Changing those settings rechecks admission on every request.
The Google client must allow the tenant's `/oauth/google/callback` redirect.

Admission and brokerage authority are separate. Each verified Google subject
selects one private `AlpacaAssistBinding` in the engine state root. The binding
names an existing principal contract and revocable authority grant. Multiple
people can have separate bindings, including separate paper and live accounts.
Neither an email address nor a chat argument chooses a brokerage principal.

After creating the principal's contract and grant through the engine's existing
custody providers, the host administrator binds or switches a Person with:

```sh
alpaca-engine --state-root "$ALPACA_LIVE_STATE_DIR" \
  --custody-root "$ALPACA_LIVE_CUSTODY_DIR" \
  --bind-person GOOGLE_SUBJECT --contract CONTRACT_REFERENCE \
  --authority-grant GRANT_REFERENCE
```

Use the stable subject from verified Google admission records, never an email
substitute. The command checks current contract/grant ownership, atomically
replaces only that Person's binding, and creates no trading authority. Grant
revocation remains effective immediately. Broker credentials belong only in
engine custody; session and seal keys belong in the host credential service.

An unconnected Person can sign in and see an explicit disconnected state.
Account observations require current read scopes. Readiness and execution take
only an existing intent reference and resolve the current Person's contract and
grant on every call. Readiness submits no order. Execution can submit a real
order under that existing authority and reports pending reconciliation as pending.

Run `node --test test/*.test.mjs` with the selected production dependencies.
The HTTP tests use real ASSIST sessions and dispatch, replacing only Google
verification and broker transport. Tests never contact a brokerage account.
