// Read credentials from the operator's private file, never argv or environment dumps.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

function origin(value, { localOnly = false, productionOnly = false } = {}) {
  const url = new URL(value);
  const local = url.hostname === 'localhost';
  if (url.origin !== value || url.username || url.password ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      (localOnly && (!local || url.protocol !== 'https:')) ||
      (productionOnly && (local || url.hostname.endsWith('.localhost')))) {
    throw new Error('Use an HTTPS origin without a path, trailing slash, query or credentials (HTTP only for localhost).');
  }
  return value;
}

async function request(base, path, key, { basic = false, body } = {}) {
  return fetch(`${origin(base)}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: basic ? `Basic ${Buffer.from(`IMS:${key}`).toString('base64')}` : `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
}

async function main() {
  const [command, file] = process.argv.slice(2);
  if (command === 'new-key') {
    // stdout is captured by the wizard and written only to .env.local.
    process.stdout.write(randomBytes(32).toString('hex'));
    return;
  }
  const env = parseEnv(readFileSync(file, 'utf8'));
  const required = (name) => {
    if (!env[name]) throw new Error(`Missing ${name}; rerun the wizard.`);
    return env[name];
  };
  if (command === 'addresses') {
    origin(required('PORTAL_URL'));
    origin(required('IMS_APP_URL'), { productionOnly: true });
    origin(required('IMS_LOCAL_APP_URL'), { localOnly: true });
    origin(required('IMS_GATEWAY_URL'));
    console.log('Addresses are valid.');
  } else if (command === 'hashes') {
    for (const [name, variable] of [
      ['ims', 'IMS_GATEWAY_CALLER_KEY'],
      ['ims-audit-read', 'IMS_GATEWAY_AUDIT_READ_CALLER_KEY'],
    ]) {
      const keyHash = createHash('sha256').update(required(variable)).digest('hex');
      console.log(`${name} keyHash (not a secret): ${keyHash}`);
    }
  } else if (command === 'portal') {
    // Authentication is checked before the deliberately invalid handle. Creates no session.
    const response = await request(required('PORTAL_URL'), '/api/integrations/validate', required('PORTAL_SYSTEM_SECRET'), {
      basic: true, body: { handle: `setup-probe-${randomBytes(32).toString('hex')}`, module: 'Dashboard' },
    });
    const body = await response.json().catch(() => null);
    if (response.status !== 401 || body?.error !== 'invalid_handle') {
      throw new Error(`Portal credential check failed (HTTP ${response.status}); check registration and Portal availability.`);
    }
    console.log('Portal accepted the IMS credential. Callback handoff still needs ticket #5.');
  } else if (command === 'gateway') {
    const base = required('IMS_GATEWAY_URL');
    // Source scope is checked before validation. Missing required fields prevent a write.
    const write = await request(base, '/audit/events', required('IMS_GATEWAY_CALLER_KEY'), { body: { source: 'IMS' } });
    const failure = await write.json().catch(() => null);
    if (write.status !== 400 || failure?.error !== 'Invalid Audit Event') {
      throw new Error(`Audit write credential check failed (HTTP ${write.status}); check the ims Caller and write:IMS key.`);
    }
    const read = await request(base, '/audit/events?source=IMS&limit=1', required('IMS_GATEWAY_AUDIT_READ_CALLER_KEY'));
    const body = await read.json().catch(() => null);
    if (!read.ok || !Array.isArray(body?.events) || body.events.some((event) => event.source !== 'IMS')) {
      throw new Error(`Audit read credential check failed (HTTP ${read.status}); check ims-audit-read and read:admin.`);
    }
    console.log('Gateway audit credentials accepted; no Audit events written or displayed.');
  } else {
    throw new Error('Usage: node scripts/ims-setup.mjs <addresses|hashes|portal|gateway> <env-file>');
  }
}

main().catch((error) => {
  // Do not expose HTTP response bodies, headers, credentials or parser errors.
  console.error(error instanceof TypeError || error?.code ? 'Setup check failed; check Node version, private file and service availability.' : error.message);
  process.exitCode = 1;
});
