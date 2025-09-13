// Offline smoke test for roles logic (Node-only, no TS runtime)
const assert = require('assert');

// JS mirror of src/lib/roles.ts to avoid TS runtime import
function parseRole(raw) {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'viewer' || v === 'creator' || v === 'moderator') return v;
  return 'viewer';
}

function isAllowed(role, allowed) {
  return allowed.includes(role);
}

function canAccess(pathname, role) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (path === '/upload' || path.startsWith('/upload/')) {
    return isAllowed(role, ['creator', 'moderator']);
  }
  if (path === '/moderate' || path.startsWith('/moderate/')) {
    return isAllowed(role, ['moderator']);
  }
  return true;
}

function t() {
  assert.equal(parseRole(undefined), 'viewer');
  assert.equal(parseRole('CREATOR'), 'creator');
  assert.equal(parseRole('weird'), 'viewer');

  // viewer
  assert.equal(canAccess('/upload', 'viewer'), false);
  assert.equal(canAccess('/moderate', 'viewer'), false);

  // creator
  assert.equal(canAccess('/upload', 'creator'), true);
  assert.equal(canAccess('/moderate', 'creator'), false);

  // moderator
  assert.equal(canAccess('/upload', 'moderator'), true);
  assert.equal(canAccess('/moderate', 'moderator'), true);

  // public
  assert.equal(canAccess('/', 'viewer'), true);
}

t();
console.log('✅ roles-smoke OK');
