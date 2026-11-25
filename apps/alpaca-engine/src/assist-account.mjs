import { sha256Hex } from "@red-cup-engineering/semiotic-content-address-system";

export function alpacaAssistBindingReference(subject) {
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 512) throw new TypeError('google-person-subject-required');
  return 'google:' + sha256Hex(subject);
}

/** Resolve a host-maintained brokerage binding for the currently verified Person.
 * Login membership never supplies brokerage authority or a caller-selected account. */
export function alpacaAssistAccount({ brokerage, principal }) {
  const identity = principal?.verifiedIdentity;
  if (!principal?.id || identity?.issuer !== 'https://accounts.google.com'
    || identity.subject !== principal.subject || identity.emailVerified !== true) {
    throw new TypeError('verified-alpaca-assist-person-required');
  }
  const reference = alpacaAssistBindingReference(identity.subject);
  const binding = async () => {
    const record = await brokerage.readRecord('assist-bindings', reference);
    if (record.type !== 'AlpacaAssistBinding' || record.personIssuer !== identity.issuer
      || record.personSubject !== identity.subject || typeof record.principal !== 'string'
      || !record.principal || typeof record.authorityGrantReference !== 'string') {
      throw new TypeError('current-person-alpaca-binding-required');
    }
    const grant = await brokerage.readRecord('authority-grants', record.authorityGrantReference);
    if (grant.principal !== record.principal) throw new TypeError('alpaca-person-authority-mismatch');
    return record;
  };
  const executionReferences = async intentReference => {
    if (typeof intentReference !== 'string' || !intentReference.trim() || intentReference.length > 512) {
      throw new TypeError('recorded-intent-reference-required');
    }
    const record = await binding();
    const contract = await brokerage.readRecord('contracts', record.contractReference);
    if (contract.principal !== record.principal) throw new TypeError('alpaca-person-contract-mismatch');
    return { contractReference: record.contractReference, authorityGrantReference: record.authorityGrantReference, intentReference };
  };
  return Object.freeze({
    async connection() {
      try {
        const record = await binding();
        const grant = await brokerage.readRecord('authority-grants', record.authorityGrantReference);
        return { configured: true, venue: grant.venue, revoked: grant.revoked,
          expired: !Number.isFinite(Date.parse(grant.validUntil)) || Date.parse(grant.validUntil) <= Date.now() };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return { configured: false, reason: 'No brokerage authority is bound to this signed-in person.' };
      }
    },
    async observe() {
      const record = await binding();
      return brokerage.observe({ authorityGrantReference: record.authorityGrantReference });
    },
    async readiness({ intentReference }) {
      return brokerage.preflight(await executionReferences(intentReference));
    },
    async execute({ intentReference }) {
      return brokerage.execute(await executionReferences(intentReference));
    },
  });
}
