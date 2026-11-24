import { createAssistEngine } from '@red-cup-engineering/assist/web';
import { assistOperation, ToolError } from '@red-cup-engineering/assist/tools';
import { createInvitedGoogleLogin } from '@red-cup-engineering/assist/web/invited-google';
import { createAssistPublicAssets } from '@red-cup-engineering/assist/web/public-assets';
import { createTufteApplication, tuftePage } from '@red-cup-engineering/tufte/application';
import { openProductionAlpacaBrokerage } from '@red-cup-engineering/alpaca-engine';
import { alpacaAssistAccount } from '@red-cup-engineering/alpaca-engine/assist-account';

export const ALPACA_ASSIST_ORIGIN = 'https://alpaca.assist.561.group';
const empty = { type: 'object', properties: {}, additionalProperties: false };
const intentInput = { type: 'object', required: ['intentReference'], additionalProperties: false,
  properties: { intentReference: { type: 'string', minLength: 1, maxLength: 512 } } };
const answer = data => ({ data, observations: [] });
const accountFor = (brokerage, context) => alpacaAssistAccount({ brokerage, principal: context.principal });
async function useAccount(brokerage, context, action, input) {
  try { return await accountFor(brokerage, context)[action](input); }
  catch (error) {
    if (error.code === 'ENOENT') throw new ToolError('No current account authority is connected to your identity.', 'missing_scope');
    throw error;
  }
}

export function alpacaAssistTools(brokerage) {
  return [
    assistOperation({ id: 'alpaca_connection', description: 'Read whether the signed-in person has an account authority binding. This grants no trading authority.',
      parameters: empty, effects: ['private-data-read'], handler: async context => answer(await accountFor(brokerage, context).connection()) }),
    assistOperation({ id: 'alpaca_account', description: 'Read and record this person’s authorized Alpaca account and current positions through the consolidated engine.',
      parameters: empty, effects: ['network-read', 'private-observation-write'], handler: async context => {
        const receipt = await useAccount(brokerage, context, 'observe');
        const account = receipt.account.payload;
        return { data: { observedAt: receipt.observedAt, venue: receipt.venue, receipt: receipt.id,
          account: { status: account.status, currency: account.currency, cash: account.cash, equity: account.equity,
            buyingPower: account.buying_power, tradingBlocked: account.trading_blocked === true },
          positions: receipt.positions.payload.slice(0, 50).map(position => ({ symbol: position.symbol,
            quantity: position.qty, marketValue: position.market_value, unrealizedPnl: position.unrealized_pl })),
          positionCount: receipt.positions.payload.length },
          observations: [{ type: receipt.type, id: receipt.id, observedAt: receipt.observedAt, orderEffect: false }] };
      } }),
    ...['readiness', 'execute'].map(action => assistOperation({ id: `alpaca_${action}_intent`,
      description: action === 'readiness' ? 'Check one recorded order intent against this person’s current contract and authority. No order is submitted.'
        : 'Execute and reconcile one recorded order intent under this person’s existing brokerage authority. This may place a real order; it accepts no new symbol, amount, venue or credential.',
      parameters: intentInput, effects: action === 'readiness' ? ['private-data-read'] : ['network-write', 'private-observation-write'],
      handler: async (context, input) => answer(await useAccount(brokerage, context, action, input)) })),
  ];
}

function dashboard(connection, reading) {
  const tiles = [{ id: 'connection', title: 'Account connection', span: 12,
    content: connection.configured ? `Connected to ${connection.venue}. ${connection.revoked || connection.expired ? 'Current authority is unavailable.' : 'Authority is checked again for each request.'}`
      : 'Your account is not connected yet. An account owner must connect existing brokerage authority to your identity.' }];
  if (reading) tiles.push(
    { id: 'account', title: 'Current account observation', span: 12,
      content: `Observed ${reading.observedAt}. Receipt ${reading.receipt}.`,
      table: { columns: ['Currency', 'Cash', 'Equity', 'Buying power', 'Account status'],
        rows: [[reading.account.currency, reading.account.cash, reading.account.equity, reading.account.buyingPower, reading.account.status]] } },
    { id: 'positions', title: 'Positions', span: 12, content: `${reading.positionCount} current positions; showing up to 50.`,
      table: { columns: ['Symbol', 'Quantity', 'Market value', 'Unrealized P&L'],
        rows: reading.positions.map(position => [position.symbol, position.quantity, position.marketValue, position.unrealizedPnl]) } });
  return { title: 'Alpaca Assist', subtitle: 'Your account, portfolio evidence, and authorized order intents',
    navigation: [{ href: '/dashboard.html', label: 'Account' }, { href: '/settings.html', label: 'Settings' }, { href: '/chat.html', label: 'Assistant' }], tiles };
}

export function alpacaAssistRecord({ brokerage, publicUrl = ALPACA_ASSIST_ORIGIN }) {
  if (publicUrl !== ALPACA_ASSIST_ORIGIN || !brokerage?.readRecord || !brokerage?.observe || !brokerage?.execute) {
    throw new TypeError('canonical-alpaca-assist-origin-and-engine-required');
  }
  return {
    brand: { id: 'alpaca-assist', name: 'Alpaca Assist', publicUrl,
      cookieName: 'alpaca_assist_session', tokenPrefix: 'alpaca', serverInfo: { name: 'alpaca-assist', version: '0.1.0' } },
    principalKind: 'google-person', credentialProvider: 'alpaca',
    requiredCapabilities: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ASSIST_OWNER_EMAIL'],
    login: createInvitedGoogleLogin({ appId: 'alpaca-assist', publicUrl, principalKind: 'google-person' }),
    buildToolCtx: ({ principal }) => ({ principal }),
    tools: alpacaAssistTools(brokerage),
    systemInstruction: () => 'Use only the registered Alpaca tools for the currently authenticated person. Account observations and readiness checks do not grant trading authority. Execute an existing recorded intent only when the person explicitly asks to execute that intent. Report pending or refused execution accurately; never claim a fill or completed reconciliation without its receipt. Never request broker secrets in conversation.',
    routes: [
      { match: '/dashboard.html', methods: ['GET'], handler: async (context, assist) => {
        const connection = (await assist.execute('alpaca_connection', {})).data;
        const reading = connection.configured && !connection.revoked && !connection.expired
          ? (await assist.execute('alpaca_account', {})).data : null;
        return createTufteApplication({ pages: [{ match: '/dashboard.html', load: () => tuftePage(dashboard(connection, reading)) }] }).fetch(context.request);
      } },
      { match: '/api/alpaca/account', methods: ['GET'], handler: async (_context, assist) => Response.json(await assist.execute('alpaca_account', {})) },
    ],
  };
}

/** MetroPlat binds shared authentication and private custody once for this tenant. */
export function createAlpacaAssistHostedApplication({ configuration, environment = process.env } = {}) {
  if (configuration?.publicUrl !== ALPACA_ASSIST_ORIGIN || configuration.hosts?.length !== 1
    || configuration.hosts[0] !== 'alpaca.assist.561.group') throw new TypeError('one-canonical-alpaca-assist-tenant-required');
  const required = ['SESSION_SECRET', 'SEAL_KEY', 'ASSIST_STATE_ROOT', 'ASSIST_OWNER_EMAIL',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ALPACA_STATE_ROOT', 'ALPACA_CUSTODY_ROOT'];
  const bindings = configuration.environmentBindings;
  const optional = ['ASSIST_MEMBER_EMAILS'];
  if (!bindings || Object.keys(bindings).some(name => ![...required, ...optional].includes(name))
    || required.some(name => typeof bindings[name] !== 'string' || typeof environment[bindings[name]] !== 'string' || !environment[bindings[name]])) {
    throw new TypeError('explicit-alpaca-assist-private-capabilities-required');
  }
  const capabilities = Object.fromEntries(required.map(name => [name, environment[bindings[name]]]));
  for (const name of optional) if (bindings[name]) capabilities[name] = environment[bindings[name]] ?? '';
  if (capabilities.SESSION_SECRET.length < 32) throw new TypeError('private-alpaca-session-secret-required');
  const brokerage = openProductionAlpacaBrokerage({ stateRoot: capabilities.ALPACA_STATE_ROOT, custodyRoot: capabilities.ALPACA_CUSTODY_ROOT });
  capabilities.ASSETS = createAssistPublicAssets();
  const record = alpacaAssistRecord({ brokerage });
  const application = createAssistEngine(record, Object.freeze(capabilities));
  const entry = createTufteApplication({ pages: [{ match: '/', load: () => tuftePage({ title: 'Alpaca Assist',
    subtitle: 'Private Alpaca account review and authorized trading', navigation: [],
    tiles: [{ id: 'enter', title: 'Your private workspace', span: 12,
      content: 'Sign in to review the account authority connected to your identity, inspect current account evidence, and use approved order intents.',
      links: [{ href: '/auth/login', label: 'Sign in' }] }] }) }] });
  return Object.freeze({ hosts: Object.freeze([...configuration.hosts]), authentication: record.login.authentication,
    fetch: request => new URL(request.url).origin !== ALPACA_ASSIST_ORIGIN ? new Response(null, { status: 404 })
      : new URL(request.url).pathname === '/' && ['GET', 'HEAD'].includes(request.method) ? entry.fetch(request) : application.fetch(request) });
}
