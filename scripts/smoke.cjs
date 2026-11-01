// Requires the backend, MongoDB, Vite, and MAIL_MODE=local. Never sends email.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:5000/api';
async function call(endpoint, data, token) {
  const response = await fetch(base + endpoint, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(data && { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
(async () => {
  const config = await fs.readFile(path.join(root, 'backend/.env'), 'utf8');
  assert.match(config, /^MAIL_MODE=local$/m, 'Only run with local email configured');
  const suffix = Date.now();
  const email = `smoke${suffix}@example.test`;
  const password = 'SmokeTest123!';
  assert.equal((await call('/health')).status, 200);
  assert.equal((await call('/auth/register', { username: `smoke${suffix}`, email, password })).status, 201);
  const outbox = path.join(root, 'backend/.local/mail');
  let code;
  for (let i = 0; i < 30 && !code; i++) {
    for (const file of await fs.readdir(outbox).catch(() => [])) {
      const mail = JSON.parse(await fs.readFile(path.join(outbox, file), 'utf8'));
      if (mail.to === email) code = mail.text.match(/\b\d{6}\b/)?.[0];
    }
    if (!code) await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(code, 'OTP was saved to local outbox');
  const verified = await call('/auth/verify-code', { email, code });
  assert.equal(verified.status, 200);
  const token = verified.body.token;
  assert.equal((await call('/auth/me', null, token)).body.user.email, email);
  assert.equal((await call('/history', null, token)).status, 200);
  assert.equal((await call('/admin/stats', null, token)).status, 403);
  assert.equal((await call('/history')).status, 401);
  const proxy = await fetch('http://127.0.0.1:5173/api/health');
  assert.equal((await proxy.json()).status, 'ok');
  assert.match(await (await fetch('http://127.0.0.1:5173/')).text(), /LeafScan/);
  // Remove only the account created by this smoke test.
  const mongoose = require('../backend/node_modules/mongoose');
  const User = require('../backend/src/models/User');
  require('../backend/node_modules/dotenv').config({ path: path.join(root, 'backend/.env') });
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteOne({ email });
  await mongoose.disconnect();
  for (const file of await fs.readdir(outbox)) {
    const mail = JSON.parse(await fs.readFile(path.join(outbox, file), 'utf8'));
    if (mail.to === email) await fs.unlink(path.join(outbox, file));
  }
  console.log('PASS: registration, local OTP, JWT profile, history, access control, frontend and API proxy');
})().catch(error => { console.error(error); process.exitCode = 1; });
