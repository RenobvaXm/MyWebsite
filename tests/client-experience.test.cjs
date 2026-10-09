const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const c={window:{},URL};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/modules/client-experience-core.js'),'utf8'),c);
const x=c.window.RENOBVA_EXPERIENCE;
const project={id:'p',revision_bonus:1};
const quotes=[{id:'old',project_id:'p',status:'accepted',revisions:10,decided_at:'2026-01-01'},{id:'current',project_id:'p',status:'accepted',revisions:2,decided_at:'2026-02-01'},{id:'pending',project_id:'p',status:'pending',revisions:50,created_at:'2026-03-01'}];
test('revision count uses current accepted proposal and releases declined rounds',()=>{
 const r=x.revisions(project,quotes,[{quote_id:'current',counts_allowance:true,status:'completed'},{quote_id:'current',counts_allowance:true,status:'pending'},{quote_id:'current',counts_allowance:true,status:'declined'},{quote_id:'current',counts_allowance:false,status:'extra_quote'},{quote_id:'old',counts_allowance:true,status:'completed'}]);
 assert.equal(r.quote.id,'current');assert.equal(r.included,3);assert.equal(r.used,2);assert.equal(r.remaining,1);
});
test('no accepted proposal means no included allowance',()=>{const r=x.revisions(project,[],[]);assert.equal(r.included,0);assert.equal(r.remaining,0);assert.equal(r.quote,undefined);});
test('preview skips unsafe URLs and unrelated projects',()=>{
 assert.equal(x.preview({id:'p',preview_url:'javascript:alert(1)'},[{project_id:'other',preview_url:'https://other.example'},{project_id:'p',preview_url:'https://preview.example'}],[],[]),'https://preview.example/');
 assert.equal(x.preview({id:'p',preview_url:'http://insecure.example'},[],[],[]),null);
});
test('notification route encodes project id and restricts tabs',()=>{assert.equal(x.projectHref('p?x=1','bogus'),'/pages/portal/project.html?id=p%3Fx%3D1#overview');assert.equal(x.projectHref('p','payments',true),'/pages/admin/admin-chat.html?id=p#payments');});
const blank=()=>({project_quotes:[],project_reviews:[],payment_requests:[],project_deliveries:[],delivery_decisions:[],project_revision_requests:[]});
test('latest delivery needs approval even if an older delivery was accepted',()=>{const d=blank();d.project_deliveries=[{id:'new',project_id:'p',created_at:'2026-03-01'},{id:'old',project_id:'p',created_at:'2026-02-01'}];d.delivery_decisions=[{delivery_id:'old',decision:'accepted'}];assert.equal(x.next(project,d,{kind:'chat'}).kind,'delivery');});
test('extra revision and accepted delivery give clear next steps',()=>{const d=blank();d.project_revision_requests=[{project_id:'p',status:'extra_quote'}];assert.equal(x.next(project,d,{kind:'chat'}).label,'Extra changes need a quote');d.project_revision_requests=[];d.project_deliveries=[{id:'d',project_id:'p',created_at:'2026-03-01'}];d.delivery_decisions=[{delivery_id:'d',decision:'accepted'}];assert.equal(x.next(project,d,{kind:'chat'}).kind,'complete');});
test('quote decisions and archived history retain priority over delivery',()=>{const d=blank();d.project_quotes=[{project_id:'p',status:'pending'}];d.project_deliveries=[{id:'d',project_id:'p',created_at:'2026-03-01'}];assert.equal(x.next(project,d,{kind:'quote'}).kind,'quote');assert.equal(x.next({...project,archived_at:'date'},d,{kind:'closed'}).kind,'closed');});
