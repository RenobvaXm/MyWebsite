(() => {
  let payCtx=null, payProject=null, payRequests=[], payChannel=null, payTimer=null, syncing=false, syncAgain=false, stopped=false;
  const cfg=window.RENOBVA_PAYMENTS||{};
  const $=s=>document.querySelector(s);
  const esc=s=>(s??"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=(n,c="EUR")=>new Intl.NumberFormat(undefined,{style:"currency",currency:c}).format(Number(n||0));
  const isAdmin=()=>payCtx?.profile?.role==="admin";

  const specialServices=["Birthday Website","Anniversary / Love","Mother's Day","Wedding / Proposal","Custom Celebration"];
  function pricePresets(project){
    const service=project?.service_type||"";
    if(service==="Business Website") return [
      {label:"Landing Page — €300",amount:300,title:"Landing Page"},
      {label:"Business Website — €850",amount:850,title:"Business Website"},
      {label:"Business Website Premium — €1,200",amount:1200,title:"Business Website"}
    ];
    if(service==="Full-Stack Project") return [
      {label:"Full-Stack — €1,200",amount:1200,title:"Full-Stack Project"},
      {label:"Full-Stack Plus — €1,800",amount:1800,title:"Full-Stack Project"},
      {label:"Advanced Full-Stack — €2,500",amount:2500,title:"Full-Stack Project"}
    ];
    if(specialServices.includes(service)) return [
      {label:"Mini Surprise — €99",amount:99,title:service},
      {label:"Special — €150",amount:150,title:service},
      {label:"Ultimate Surprise — €300",amount:300,title:service}
    ];
    return [
      {label:`${service||"Website"} — €200`,amount:200,title:service||"Website development"},
      {label:`${service||"Website"} — €500`,amount:500,title:service||"Website development"},
      {label:`${service||"Website"} — €1,200`,amount:1200,title:service||"Website development"}
    ];
  }
  function recommendedPresetIndex(project,presets){
    const budget=project?.budget||"";
    const nums=[...budget.matchAll(/(?:€\s*)?([0-9][0-9.,]*)/g)].map(m=>Number(m[1].replace(/\./g,"").replace(",","."))).filter(Boolean);
    if(!nums.length)return 0;
    const target=nums.length>1?(nums[0]+nums[1])/2:nums[0];
    let best=0,dist=Infinity;presets.forEach((x,i)=>{const d=Math.abs(x.amount-target);if(d<dist){dist=d;best=i}});return best;
  }

  function ensureUI(){
    const form=$("#chatForm"); if(!form||$("#paymentDock"))return;
    const dock=document.createElement("div");dock.id="paymentDock";dock.className="payment-dock";dock.hidden=true;form.parentNode.insertBefore(dock,form);
    if(isAdmin()){
      const head=$(".chat-head");
      const b=document.createElement("button");b.type="button";b.id="requestPaymentBtn";b.className="payment-request-btn";b.innerHTML="€ <span>Request payment</span>";head?.appendChild(b);
      b.onclick=openAdminModal;
    }
    const modal=document.createElement("div");modal.id="paymentModal";modal.className="payment-modal";modal.hidden=true;document.body.appendChild(modal);
  }

  function activeRequest(){return [...payRequests].reverse().find(x=>!["paid","cancelled"].includes(x.status))||[...payRequests].reverse().find(x=>x.status==="paid")}
  function renderDock(){
    const dock=$("#paymentDock");if(!dock)return;const p=activeRequest();
    if(!p){dock.hidden=true;dock.innerHTML="";return}dock.hidden=false;
    const state=p.status==="paid"?"paid":p.status==="submitted"?"submitted":"pending";
    dock.innerHTML=`<div class="payment-card ${state}"><div class="payment-card-icon">${p.status==="paid"?"✓":"€"}</div><div class="payment-card-copy"><small>${p.status==="paid"?"PAYMENT RECEIVED":p.status==="submitted"?"PAYMENT SUBMITTED":"PAYMENT REQUEST"}</small><b>${esc(p.title)}</b>${p.note?`<span>${esc(p.note)}</span>`:""}<em>${money(p.amount,p.currency)}</em></div><div class="payment-card-actions">${actions(p)}</div></div>`;
    dock.querySelector("[data-pay]")?.addEventListener("click",()=>openClientModal(p));
    dock.querySelector("[data-paid]")?.addEventListener("click",()=>adminSetStatus(p.id,"paid"));
    dock.querySelector("[data-cancel-pay]")?.addEventListener("click",()=>adminSetStatus(p.id,"cancelled"));
  }
  function actions(p){
    if(p.status==="paid")return `<span class="payment-status-ok">Paid</span>`;
    if(isAdmin()&&p.stripe_locked)return `<span class="payment-status-wait">Stripe confirmation automatic</span>`;
    if(isAdmin())return `${p.status==="submitted"?`<button type="button" class="btn primary compact" data-paid>Confirm paid</button>`:""}<button type="button" class="mini-pay-btn" data-cancel-pay>Cancel</button>`;
    if(p.status==="submitted")return `<span class="payment-status-wait">Awaiting confirmation</span>`;
    return `<button type="button" class="btn primary compact" data-pay>Pay ${money(p.amount,p.currency)}</button>`;
  }

  // Calculate in cents so the preview and saved payment always agree.
  function discountedPrice(base,percent){
    if(!Number.isFinite(base)||base<=0||!Number.isFinite(percent)||percent<0||percent>=100)return null;
    const original=Math.round(base*100),total=Math.round(original*(1-percent/100));
    if(total<1)return null;
    return {original:original/100,total:total/100,saved:(original-total)/100,percent};
  }

  function openAdminModal(){
    const presets=pricePresets(payProject),recommended=recommendedPresetIndex(payProject,presets);
    const service=payProject?.service_type||"Website development";
    const projectTitle=payProject?.title||service;
    const options=presets.map((x,i)=>`<option value="${i}" ${i===recommended?"selected":""}>${esc(x.label)}</option>`).join("")+`<option value="custom">Custom price…</option>`;
    const selected=presets[recommended];
    const m=$("#paymentModal");m.hidden=false;m.innerHTML=`<div class="payment-modal-backdrop" data-close-pay></div><form class="payment-dialog" id="paymentRequestForm"><button class="payment-x" type="button" data-close-pay>×</button><small class="payment-kicker">RENOBVA · ADMIN</small><h2>Request payment</h2><p>This client requested <b>${esc(service)}</b>${payProject?.budget?` with a budget of <b>${esc(payProject.budget)}</b>`:""}. A matching price is selected automatically, but you can change it.</p><label>Price<select id="paymentPricePreset" name="price_preset" class="payment-select">${options}</select></label><label id="customPaymentAmount" hidden>Custom amount<div class="money-input"><span>€</span><input name="custom_amount" type="number" min="0.01" step="0.01" placeholder="Enter your price"></div></label><input type="hidden" name="amount" value="${selected.amount}"><label>Discount (%)<input name="discount_percent" type="number" min="0" max="99.99" step="0.01" value="0" placeholder="e.g. 10"><small>Optional. Applied to this payment request only.</small></label><div class="discount-summary" aria-live="polite" id="discountSummary"></div><label>For<select id="paymentForPreset" name="for_preset" class="payment-select"><option value="service" selected>${esc(service)}</option><option value="project">${esc(projectTitle)}</option><option value="custom">Custom…</option></select><input id="paymentCustomTitle" name="custom_title" maxlength="120" placeholder="Enter custom payment title" hidden></label><input type="hidden" name="title" value="${esc(service)}"><label>Note<textarea name="note" maxlength="500" placeholder="e.g. 50% deposit for your project"></textarea></label><div class="payment-dialog-actions"><button type="button" class="btn" data-close-pay>Cancel</button><button class="btn primary" type="submit">Send request</button></div></form>`;
    bindClose();
    const form=$("#paymentRequestForm"),priceSelect=$("#paymentPricePreset"),customWrap=$("#customPaymentAmount"),customAmount=form.elements.custom_amount,amount=form.elements.amount,forSelect=$("#paymentForPreset"),customTitle=$("#paymentCustomTitle"),title=form.elements.title;
    const discount=form.elements.discount_percent;
    function updatePrice(){
      const base=priceSelect.value==='custom'?Number(customAmount.value):presets[Number(priceSelect.value)].amount;
      const percent=discount.value.trim()===''?0:Number(discount.value);
      const result=discountedPrice(base,percent);
      discount.setCustomValidity(Number.isFinite(percent)&&percent>=0&&percent<100?'':'Enter a discount from 0 to 99.99%.');
      amount.value=result?result.total.toFixed(2):'';
      form.dataset.originalAmount=result?result.original:'';
      form.dataset.discountPercent=result?result.percent:'';
      $('#discountSummary').innerHTML=result?`<div><span>Original price</span><b>${money(result.original)}</b></div><div><span>Discount (${result.percent}%)</span><b>−${money(result.saved)}</b></div><div class="discount-total"><span>Client pays</span><strong>${money(result.total)}</strong></div>`:'Choose a valid price and discount.';
    }
    priceSelect.onchange=()=>{const custom=priceSelect.value==='custom';customWrap.hidden=!custom;customAmount.required=custom;if(custom)customAmount.focus();updatePrice()};
    customAmount.oninput=updatePrice;discount.oninput=updatePrice;updatePrice();
    forSelect.onchange=()=>{const custom=forSelect.value==="custom";customTitle.hidden=!custom;customTitle.required=custom;if(custom){title.value="";customTitle.focus()}else title.value=forSelect.value==="project"?projectTitle:service};
    customTitle.oninput=()=>{if(forSelect.value==="custom")title.value=customTitle.value};
    window.RENOBVA_DRAFTS?.attach(form,'Payment request');form.onsubmit=event=>{updatePrice();if(form.reportValidity())createRequest(event);else event.preventDefault()};
  }
  async function createRequest(e){
    e.preventDefault();const fd=new FormData(e.target),amount=Number(fd.get("amount"));if(!amount||amount<=0)return toast("Enter a valid amount.","warn");
    const percent=Number(e.target.dataset.discountPercent||0),original=Number(e.target.dataset.originalAmount);
    const calculated=discountedPrice(original,percent);
    if(!calculated||Math.abs(calculated.total-amount)>0.00001)return toast('Please check the price and discount.','warn');
    const discountNote=percent>0?`Discount: ${percent}% off ${money(calculated.original)} (saved ${money(calculated.saved)}).`:'';
    const note=[String(fd.get('note')||'').trim(),discountNote].filter(Boolean).join('\n');
    const btn=e.submitter;btn.disabled=true;btn.textContent="Sending…";
    const {data,error}=await renobva.sb.from("payment_requests").insert({project_id:payProject.id,client_id:payProject.user_id,created_by:payCtx.user.id,amount,currency:"EUR",title:fd.get("title").trim(),note:note||null}).select("*").single();
    btn.disabled=false;btn.textContent="Send request";if(error)return toast(error.message,"error");window.RENOBVA_DRAFTS?.clear(e.target);payRequests.push(data);closeModal();renderDock();toast("Payment request sent.");
  }

  function openClientModal(p){
    const m=$("#paymentModal");m.hidden=false;m.innerHTML=`<div class="payment-modal-backdrop" data-close-pay></div><div class="payment-dialog payment-method-dialog"><button class="payment-x" type="button" data-close-pay>×</button><small class="payment-kicker">SECURE PAYMENT OPTIONS</small><h2>${money(p.amount,p.currency)}</h2><p>${esc(p.title)}. Choose how you want to pay.</p><div class="payment-methods">${method("stripe","Stripe Checkout","Pay securely by card or an available wallet")}${method("bank","Bank Transfer","Transfer directly to RENOBVA")}</div><div id="methodDetails"></div></div>`;bindClose();m.querySelectorAll("[data-method]").forEach(b=>b.onclick=()=>showMethod(p,b.dataset.method));
  }
  function method(id,name,desc){
    if(id==="bank"&&payRequests.some(p=>p.stripe_locked&&p.status==="pending"))return "";
    if(id==="stripe"&&!cfg.checkout?.dynamic)return "";
    if(cfg[id]?.enabled===false)return "";
    return `<button type="button" class="payment-method" data-method="${id}"><span class="method-logo method-${id}">${id==="stripe"?"S":"↗"}</span><span><b>${name}</b><small>${desc}</small></span><strong>›</strong></button>`;
  }
  function showMethod(p,method){
    const d=$("#methodDetails");let html="";
    if(cfg.checkout?.dynamic && method==="stripe"){
      d.innerHTML=`<div class="method-detail"><p>Stripe checkout will charge ${money(p.amount,p.currency)}. Available cards and wallets are shown there. Payment confirmation is automatic.</p><button type="button" class="btn primary full" id="stripePayButton">Open secure checkout</button><p id="stripePayError" role="alert"></p></div>`;
      d.scrollIntoView({block:"nearest",behavior:"smooth"});
      $("#stripePayButton").onclick=async e=>{
        const b=e.currentTarget;b.disabled=true;b.textContent="Opening checkout…";
        try{
          const {data,error}=await renobva.sb.functions.invoke("stripe-checkout",{body:{payment_id:p.id}});
          if(error){let message="Checkout unavailable. Please contact RENOBVA.";try{message=(await error.context.json()).error||message}catch{}throw Error(message)}
          if(data?.error)throw Error(data.error);
          const url=new URL(data.url);if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com")throw Error("Invalid checkout response.");
          location.assign(url.href);
        }catch(error){$("#stripePayError").textContent=error.message;b.disabled=false;b.textContent="Try again";}
      };return;
    }
    if(method==="bank"){
      const b=cfg.bank||{};html=`<div class="method-detail"><button class="method-back" type="button" data-method-back>← Payment methods</button><h3>Bank transfer</h3><div class="bank-details"><p><small>Account name</small><b>${esc(b.accountName||"Not configured")}</b></p><p><small>IBAN</small><b>${esc(b.iban||"Add your IBAN in payment-config.js")}</b></p>${b.bic?`<p><small>BIC</small><b>${esc(b.bic)}</b></p>`:""}${b.bankName?`<p><small>Bank</small><b>${esc(b.bankName)}</b></p>`:""}<p><small>Reference</small><b>REN-${esc(p.id.slice(0,8).toUpperCase())}</b></p><p><small>Amount</small><b>${money(p.amount,p.currency)}</b></p></div><label>Optional transfer/reference ID<input id="paymentReference" placeholder="Your transfer reference"></label><button class="btn primary full" type="button" data-submit-method="bank">I've sent the transfer</button></div>`;
    } else return;
    d.innerHTML=html;d.querySelector("[data-method-back]")?.addEventListener("click",()=>d.innerHTML="");d.querySelector("[data-submit-method]")?.addEventListener("click",e=>submitMethod(p,e.currentTarget.dataset.submitMethod));
  }
  async function submitMethod(p,method){
    const ref=$("#paymentReference")?.value||null;const {data,error}=await renobva.sb.rpc("submit_payment_request",{p_payment:p.id,p_method:method,p_reference:ref});if(error)return toast(error.message,"error");
    const updated=Array.isArray(data)?data[0]:data;payRequests=payRequests.map(x=>x.id===p.id?updated:x);closeModal();renderDock();toast("Payment submitted. RENOBVA will confirm it shortly.");
  }
  async function adminSetStatus(id,status){
    if(status==="cancelled"&&!confirm("Cancel this payment request?"))return;
    const patch={status,updated_at:new Date().toISOString()};if(status==="paid")patch.paid_at=new Date().toISOString();
    const {data,error}=await renobva.sb.from("payment_requests").update(patch).eq("id",id).select("*").single();if(error)return toast(error.message,"error");payRequests=payRequests.map(x=>x.id===id?data:x);renderDock();toast(status==="paid"?"Payment confirmed.":"Payment request cancelled.");
  }
  function bindClose(){$("#paymentModal")?.querySelectorAll("[data-close-pay]").forEach(x=>x.onclick=closeModal)}function closeModal(){const m=$("#paymentModal");if(m)m.hidden=true}
  async function syncPayments(){
    if(stopped||!payProject)return;
    if(syncing){syncAgain=true;return}
    syncing=true;
    try{
      const {data,error}=await renobva.sb.from('payment_requests').select('*').eq('project_id',payProject.id).order('created_at');
      // Keep the last successful state during temporary network errors.
      if(!error&&!stopped&&JSON.stringify(data||[])!==JSON.stringify(payRequests)){
        payRequests=data||[];renderDock();
      }
    }catch{
      // Retry on the next live event or automatic check.
    }finally{
      syncing=false;
      if(syncAgain&&!stopped){syncAgain=false;syncPayments()}
    }
  }
  window.addEventListener('renobva:retry',syncPayments);async function init(){
    const id=new URLSearchParams(location.search).get("id");if(!id)return;
    for(let i=0;i<40&&!window.renobva;i++)await new Promise(r=>setTimeout(r,100));if(!window.renobva)return;
    payCtx=await requireAuth(location.pathname.includes("/admin/"));if(!payCtx)return;
    const {data:p}=await renobva.sb.from("projects").select("id,user_id,title,service_type,budget").eq("id",id).single();if(!p)return;payProject=p;ensureUI();
    // Subscribe before the initial read; polling covers interrupted realtime connections.
    payChannel=renobva.sb.channel("renobva-payments-"+id+"-"+payCtx.user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"payment_requests",filter:`project_id=eq.${id}`},()=>syncPayments())
      .subscribe(status=>{if(status==="SUBSCRIBED")syncPayments()});
    await syncPayments();
    payTimer=setInterval(()=>{if(!document.hidden)syncPayments()},2000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncPayments()});
    window.addEventListener('focus',()=>syncPayments());
    window.addEventListener('pagehide',()=>{stopped=true;clearInterval(payTimer);if(payChannel)renobva.sb.removeChannel(payChannel)});
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});

  }
  init();
})();
