import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const [origin, mappingPath, evidencePath] = process.argv.slice(2);
if (!origin || !mappingPath || !evidencePath || !process.env.IMS_SHOP_API_KEY || !process.env.IMS_GATEWAY_URL || !process.env.IMS_GATEWAY_AUDIT_READ_CALLER_KEY) throw new Error('Provide origin, mapping JSON, evidence JSON and IMS_SHOP_API_KEY.');
const mapping = JSON.parse(await readFile(mappingPath, 'utf8'));
const first = mapping['1'], second = mapping['2'];
if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second) || first === second) throw new Error('Map two distinct demo Sizes (storefront ids 1 and 2).');
const run = `verify367-${randomUUID()}`;
const proof = { run, origin, startedAt: new Date().toISOString(), checks: [], completed: false };
const lines = new Map();
function passed(name) { proof.checks.push(name); console.log(`PASS ${name}`); }
async function call(path, options = {}) {
  const response = await fetch(`${origin.replace(/\/$/, '')}${path}`, { ...options, signal: AbortSignal.timeout(30000) });
  return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
}
async function read(id) {
  const result = await call(`/api/shop/stock?productId=${id}`, { headers: { Authorization: `Bearer ${process.env.IMS_SHOP_API_KEY}` } });
  assert.equal(result.status, 200); assert.equal(result.cache, 'no-store'); assert.equal(result.body.warehouseId, 1000);
  return result.body;
}
async function move(operation, orderId, quantity, productId = first) {
  const key = `${orderId}/line-1`;
  if (!lines.has(key)) lines.set(key, { orderId, lineId: 'line-1', quantity, productId, state: 'unknown' });
  const result = await call('/api/shop/stock', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.IMS_SHOP_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, orderId, lineId: 'line-1', quantity, productId }),
  });
  if (result.status === 200) lines.get(key).state = result.body.state;
  else if (operation === 'reserve' && [404, 409].includes(result.status)) lines.get(key).state = 'refused';
  return result;
}
try {
  for (const [kind, headers] of [
    ['missing credential', {}], ['wrong credential', { Authorization: 'Bearer wrong' }],
    ['POS-style header', { 'X-API-Key': process.env.IMS_SHOP_API_KEY }],
    ...(process.env.PORTAL_SYSTEM_SECRET ? [['actual Portal credential', { Authorization: `Bearer ${process.env.PORTAL_SYSTEM_SECRET}` }]] : []),
  ]) { assert.equal((await call(`/api/shop/stock?productId=${first}`, { headers })).status, 401); passed(`${kind} refused`); }
  const baseline = await read(first), other = await read(second);
  assert.deepEqual(baseline, { warehouseId: 1000, productId: first, quantity: 20, reserved: 0, available: 20 });
  assert.equal(other.available, 20);
  proof.baseline = baseline; passed('Warehouse read is on-demand, no-store, and excludes the separate 20-unit POS Branch fixture');
  const concurrent = await Promise.all([move('reserve', `${run}-buyer-a`, 13), move('reserve', `${run}-buyer-b`, 13)]);
  assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409]);
  assert.equal((await read(first)).available, 7);
  const winner = concurrent[0].status === 200 ? `${run}-buyer-a` : `${run}-buyer-b`;
  assert.equal((await move('release', winner, 13)).status, 200);
  assert.equal((await move('release', winner, 13)).status, 200);
  passed('concurrent Orders cannot oversell and cancellation release is idempotent');
  const retry = `${run}-retry`;
  assert.equal((await move('reserve', retry, 1)).status, 200);
  assert.equal((await move('reserve', retry, 1)).status, 200);
  assert.equal((await read(first)).reserved, 1);
  assert.equal((await move('release', retry, 1)).status, 200);
  assert.equal((await move('reserve', retry, 1)).body.state, 'released');
  passed('reserve replay changes stock once and delayed reserve does not resurrect a released line');
  const pack = `${run}-pack`;
  assert.equal((await move('reserve', pack, 1)).status, 200);
  assert.equal((await move('deduct', pack, 1)).status, 200);
  assert.equal((await move('deduct', pack, 1)).status, 200);
  assert.equal((await read(first)).quantity, 19);
  assert.equal((await move('add_back', pack, 1)).status, 200);
  assert.equal((await move('add_back', pack, 1)).status, 200);
  assert.deepEqual(await read(first), baseline); assert.deepEqual(await read(second), other);
  passed('packing deduction and sellable add-back replay once; another Size and original balances are unchanged');
  if (process.env.IMS_GATEWAY_URL && process.env.IMS_GATEWAY_AUDIT_READ_CALLER_KEY) {
    const query = new URLSearchParams({ source: 'IMS', q: run, limit: '100' });
    const response = await fetch(`${process.env.IMS_GATEWAY_URL.replace(/\/$/, '')}/audit/events?${query}`, {
      headers: { Authorization: `Bearer ${process.env.IMS_GATEWAY_AUDIT_READ_CALLER_KEY}` }, signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200); const body = await response.json();
    assert.equal(body.events.length, 7); assert.equal(new Set(body.events.map(event => event.id)).size, 7);
    assert.equal(body.events.filter(event => event.description.startsWith('Shop stock reserve:')).length, 3);
    assert.equal(body.events.filter(event => event.description.startsWith('Shop stock release:')).length, 2);
    assert.equal(body.events.filter(event => event.description.startsWith('Shop stock deduct:')).length, 1);
    assert.equal(body.events.filter(event => event.description.startsWith('Shop stock add_back:')).length, 1);
    proof.auditEventIds = body.events.map(event => event.id); passed('central audit contains exactly one event for each committed movement');
  }
  proof.completed = true;
} finally {
  for (const line of lines.values()) {
    if (line.state === 'unknown') {
      const result = await move('reserve', line.orderId, line.quantity, line.productId);
      if (![200, 404, 409].includes(result.status)) throw new Error('Demo stock recovery needs operator attention.');
    }
    if (line.state === 'reserved' || line.state === 'deducted') {
      const result = await move(line.state === 'reserved' ? 'release' : 'add_back', line.orderId, line.quantity, line.productId);
      assert.equal(result.status, 200);
    }
  }
  proof.finishedAt = new Date().toISOString();
  await writeFile(evidencePath, JSON.stringify(proof, null, 2) + '\n');
}
