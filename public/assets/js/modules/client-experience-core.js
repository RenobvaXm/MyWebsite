/* Pure presentation helpers shared by the client home, project tools and tests. */
window.RENOBVA_EXPERIENCE = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const acceptedQuote = rows => [...rows].filter(q => q.status === 'accepted').sort((a,b) => String(b.decided_at || b.created_at).localeCompare(String(a.decided_at || a.created_at)) || String(b.id).localeCompare(String(a.id)))[0];
  function revisions(project, quotes, requests) {
    const quote = acceptedQuote(quotes.filter(q => q.project_id === project.id));
    const included = quote ? Number(quote.revisions) + Number(project.revision_bonus || 0) : 0;
    const used = quote ? requests.filter(r => r.quote_id === quote.id && r.counts_allowance && r.status !== 'declined').length : 0;
    return {quote, included, used, remaining: Math.max(0, included - used)};
  }
  function preview(project, reviews, deliveries, handovers) {
    const values = [project.preview_url, ...reviews.filter(r => r.project_id === project.id).map(r => r.preview_url), ...deliveries.filter(r => r.project_id === project.id).map(r => r.preview_url), ...handovers.filter(r => r.project_id === project.id).map(r => r.website_url)];
    for (const value of values) {try {const url = new URL(value);if(url.protocol === 'https:')return url.href;}catch{}}
    return null;
  }
  const projectHref = (id, tab='overview', admin=false) => `/pages/${admin?'admin/admin-chat':'portal/project'}.html?id=${encodeURIComponent(id)}#${['overview','chat','files','payments','feedback','handover','activity'].includes(tab)?tab:'overview'}`;
  function next(project, data, fallback) {
    if(project.archived_at || project.deleted_at || project.status === 'cancelled')return fallback;
    const pending = data.project_quotes.some(q=>q.project_id===project.id && q.status==='pending');
    if(pending || data.project_reviews.some(r=>r.project_id===project.id && r.status==='pending') || data.payment_requests.some(p=>p.project_id===project.id && p.status==='pending'))return fallback;
    const latest = data.project_deliveries.filter(d=>d.project_id===project.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0];
    const decision = latest && data.delivery_decisions.find(d=>d.delivery_id===latest.id);
    if(latest && !decision)return {label:'Approve your final delivery',detail:'Check the finished work, then accept it or submit one organized change request.',kind:'delivery'};
    const active = data.project_revision_requests.find(r=>r.project_id===project.id && ['pending','in_progress','extra_quote'].includes(r.status));
    if(active)return {label:active.status==='extra_quote'?'Extra changes need a quote':'Your revisions are being handled',detail:active.status==='extra_quote'?'RENOBVA will agree the scope and cost before starting additional work.':'Follow the request status and any response in Feedback.',kind:'revision'};
    if(decision?.decision==='accepted')return {label:'Your website is ready',detail:'Read the handover guide, explore support, or share a testimonial.',kind:'complete'};
    return fallback;
  }
  return {escape, acceptedQuote, revisions, preview, projectHref, next};
})();
