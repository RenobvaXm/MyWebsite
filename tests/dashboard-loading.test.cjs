const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '../public/assets/js/modules', name), 'utf8');

function workflow() {
  const context = { URL };
  context.window = context;
  vm.runInNewContext(source('client-experience-core.js'), context);
  vm.runInNewContext(source('workflow-core.js'), context);
  return context.RENOBVA_WORKFLOW;
}

test('client workspace loads handover data using its existing updated_at column', async () => {
  const sb = { from(table) { return { select() { return { order(column) {
    if (table === 'project_handover' && column !== 'updated_at') {
      return Promise.resolve({ error: { message: 'column project_handover.created_at does not exist' } });
    }
    return Promise.resolve({ data: table === 'project_handover' ? [{ project_id: 'p', website_url: 'https://example.com' }] : [] });
  } }; } }; } };
  const data = await workflow().load(sb);
  assert.equal(Object.keys(data).length, 10);
  assert.equal(data.project_handover[0].project_id, 'p');
  assert.equal(data.projects.length, 0);
});

test('workspace loading reports a genuine failed request instead of treating it as empty', async () => {
  const sb = { from(table) { return { select() { return { order() {
    return Promise.resolve(table === 'projects' ? { error: { message: 'Connection lost' } } : { data: [] });
  } }; } }; } };
  await assert.rejects(workflow().load(sb), error => error.message === 'Connection lost');
});

test('admin refresh explicitly joins the project owner and populates project/client state', async () => {
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); };
  let join;
  const context = {
    URLSearchParams, requireAuth: async () => false,
    document: { querySelector: element },
    renobva: { sb: { from(table) { return { select(columns) {
      if (table === 'projects') join = columns;
      return { order: async () => ({ data: table === 'projects' ? [{ id: 'p', user_id: 'c', profiles: { display_name: 'Client' } }] : [{ id: 'c', role: 'client' }, { id: 'a', role: 'admin' }] }) };
    } }; } } },
    toast: message => { throw Error(message); }
  };
  vm.runInNewContext(source('admin.js'), context);
  vm.runInNewContext('updateCounts=()=>{};renderAdmin=()=>{};renderClients=()=>{};', context);
  await context.refreshAdmin();
  assert.equal(join, '*,profiles!projects_user_id_fkey(display_name,email)');
  assert.equal(vm.runInNewContext('ADMIN_PROJECTS[0].profiles.display_name', context), 'Client');
  assert.equal(vm.runInNewContext('ADMIN_CLIENTS.length', context), 1);
  assert.equal(element('#adminRefresh').disabled, false);
});
