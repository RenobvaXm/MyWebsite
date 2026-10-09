/* Shared helpers for the RENOBVA workspace. All data access uses the signed-in client's RLS. */
window.RENOBVA_TOOLS = (() => {
 const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=(amount,currency='EUR')=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format(Number(amount||0));
 const https=value=>{const url=new URL(String(value));if(url.protocol!=='https:')throw Error('Please use an HTTPS link.');return url.href;};
 const field=(name,label,attrs='')=>`<label>${label}<input name="${name}" ${attrs}></label>`;
 const area=(name,label,value='',max=5000)=>`<label>${label}<textarea name="${name}" rows="4" maxlength="${max}">${escape(value)}</textarea></label>`;
 function dialog(title,fields,save,label='Save'){
  const box=document.createElement('dialog');box.className='workflow-dialog';box.setAttribute('aria-label',title);box.innerHTML=`<form class="form-stack"><button type="button" class="dialog-close">Close ×</button><h2>${escape(title)}</h2>${fields}<p role="alert"></p><button class="btn primary" type="submit">${escape(label)}</button></form>`;document.body.appendChild(box);
  if(!/^(Edit|Move)/.test(title)&&!box.querySelector('[type=file]'))window.RENOBVA_DRAFTS?.attach(box.querySelector('form'),title);box.querySelector('.dialog-close').onclick=()=>box.close();box.onclose=()=>box.remove();box.showModal();box.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await save(new FormData(e.target));window.RENOBVA_DRAFTS?.clear(e.target);box.close()}catch(err){box.querySelector('[role=alert]').textContent=err.message}finally{b.disabled=false}};return box;
 }
 function check(result){if(result.error)throw result.error;return result.data;}
 const date=value=>value?new Date(value.slice(0,10)+'T12:00:00').toLocaleDateString():'No date set';
 function invoiceHtml(doc){
  const s=doc.seller||{},b=doc.buyer||{},invoice=doc.document_type==='invoice';
  const title=invoice?'Invoice':'Payment receipt',number='REN-'+String(doc.number).padStart(6,'0');
  const amount=escape(money(doc.amount,doc.currency));
  const party=(label,person,fallback)=>`<section class="party"><span class="label">${label}</span><h2>${escape(person.legal_name||fallback)}</h2><p>${escape(person.address||'Billing address not provided')}</p>${person.tax_id?`<p class="tax-id">Tax / VAT ID: ${escape(person.tax_id)}</p>`:''}</section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${number} - ${title} - RENOBVA</title><style>
  @page{size:A4;margin:12mm 12mm 17mm;@bottom-left{content:"RENOBVA  /  PAYMENT DOCUMENT";font:8px Arial,sans-serif;color:#77747b}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:8px Arial,sans-serif;color:#77747b}}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html{background:#eeeef2}body{font:12px/1.65 Arial,Helvetica,sans-serif;color:#24232b;margin:24px auto;max-width:760px;padding:0 15px}
  .sheet{background:#fff;border:1px solid #dedce2}.document-head{background:#111318;color:#fff;padding:23px 28px 20px;border-bottom:5px solid #ed5437;break-inside:avoid}
  .head-table,.billing-table,.amount-table{width:100%;border-collapse:collapse;table-layout:fixed}.head-table td{vertical-align:top;padding:0}.head-table td:last-child{text-align:right;width:47%}
  .brand{font-size:23px;font-weight:800;letter-spacing:2px;white-space:nowrap}.brand svg{width:37px;height:37px;vertical-align:middle;margin-right:8px}.brand-sub{font-size:9px;letter-spacing:2px;color:#bbbfc9;margin:12px 0 0;text-transform:uppercase}
  .document-title{margin:0;font-size:34px;line-height:1.15;letter-spacing:-1px;color:#fff}.number{color:#ffad85;font-size:13px;margin:12px 0 8px;font-weight:700}.confirmed{display:inline-block;padding:5px 10px;border:1px solid #476750;color:#c6edd1;background:#1e3026;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.5px}
  .accent{height:5px;background:linear-gradient(to right,#ef3d32,#ff923a)}.document-body{padding:22px 28px}.label{font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#a73728}.issue-line{margin:0 0 20px;padding-bottom:15px;border-bottom:1px solid #e5e1e5;color:#5e5965;font-size:11px}.issue-line strong{color:#24232b}
  .billing-table{margin-bottom:22px;break-inside:avoid}.billing-table td{width:50%;vertical-align:top;padding:0 18px 0 0}.billing-table td:last-child{padding:0 0 0 18px;border-left:1px solid #e4dce0}.party h2{font-size:15px;line-height:1.4;margin:9px 0}.party p{white-space:pre-wrap;margin:6px 0;font-size:12px;overflow-wrap:anywhere}.party .tax-id{font-size:10px;color:#68626e}
  .amount-table thead th{background:#17191f;color:#fff;text-align:left;padding:12px 15px;font-size:10px;letter-spacing:1px;text-transform:uppercase}.amount-table thead th:last-child,.amount-table td:last-child{text-align:right;width:35%}.amount-table td{padding:16px 15px;background:#f7f4f5;border-bottom:1px solid #e9dfe2;font-size:13px}.amount-table td:last-child{font-weight:700;color:#a73524}
  .description{margin:18px 0 20px}.description h2{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a73524;margin:0 0 10px;break-after:avoid}.description p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;orphans:3;widows:3}
  .total-wrap{padding:18px 22px;border:1px solid #edbba7;border-left:5px solid #ec5435;background:#fff5ef;break-inside:avoid;margin:0 0 20px}.total-table{width:100%;border-collapse:collapse}.total-table td{padding:0;vertical-align:middle}.total-table td:last-child{text-align:right}.total-wrap small{color:#7b4234;font-size:10px;text-transform:uppercase;letter-spacing:1px}.total-wrap strong{display:block;font-size:29px;color:#a62f22;line-height:1.25}.settled{font-size:12px;font-weight:700;color:#29242a}.settled span{display:block;color:#71646b;font-size:10px;font-weight:400;margin-top:5px}
  .tax-note{white-space:pre-wrap;color:#645c69;font-size:11px;overflow-wrap:anywhere;margin:18px 0}.payment-ref{border-top:1px solid #e5dde2;padding-top:18px;margin:24px 0 0;font-size:10px;color:#726975;overflow-wrap:anywhere;break-inside:avoid}.payment-ref b{color:#342e39}.receipt-note{font-size:10px;line-height:1.7;color:#726975;margin-top:10px}
  .document-footer{padding:15px 28px 17px;background:#f8f6f7;border-top:1px solid #e8e0e3;break-inside:avoid}.document-footer strong{font-size:12px;color:#ac3b2a}.document-footer p{font-size:10px;color:#726975;margin:5px 0 0}
  @media print{html{background:#fff}body{max-width:none;margin:0;padding:0}.sheet{border:0}.document-head{border-bottom:0}.document-title{font-size:34px}}
  </style></head><body><article class="sheet"><header class="document-head"><table class="head-table" role="presentation"><tr><td><div class="brand"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc">
  <title id="title">Renobva R Icon</title>
  <desc id="desc">A scalable red and orange gradient R emblem on a transparent background.</desc>

  <defs>
    <linearGradient id="fire" x1="0%" y1="20%" x2="100%" y2="80%">
      <stop offset="0%" stop-color="#d90018"/>
      <stop offset="45%" stop-color="#ff2f16"/>
      <stop offset="78%" stop-color="#ff7417"/>
      <stop offset="100%" stop-color="#ffb21a"/>
    </linearGradient>

    <linearGradient id="fireReverse" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffb21a"/>
      <stop offset="42%" stop-color="#ff5217"/>
      <stop offset="100%" stop-color="#c90019"/>
    </linearGradient>

    <linearGradient id="darkFire" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7b0010"/>
      <stop offset="50%" stop-color="#c20a13"/>
      <stop offset="100%" stop-color="#ff3c16"/>
    </linearGradient>

    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Upper ribbon / bowl -->
  <path
    d="M145 175
       H685
       C800 175 885 260 885 375
       C885 490 800 575 685 575
       H605
       L515 455
       H675
       C724 455 765 416 765 367
       C765 318 724 285 675 285
       H245
       Z"
    fill="url(#fire)"
  />

  <!-- Inner depth -->
  <path
    d="M245 285 H675
       C724 285 765 318 765 367
       C765 416 724 455 675 455
       H515
       L575 535
       H690
       C782 535 845 469 845 375
       C845 281 778 215 685 215
       H185 Z"
    fill="url(#darkFire)"
    opacity=".48"
  />

  <!-- Main diagonal leg -->
  <path
    d="M330 405
       H495
       L855 825
       H680
       Z"
    fill="url(#fireReverse)"
  />

  <!-- Highlight on diagonal -->
  <path
    d="M359 425
       H478
       L801 801
       H746
       Z"
    fill="#ffb01b"
    opacity=".22"
  />

  <!-- Left arrow / development accent -->
  <path
    d="M150 410
       L330 595
       L150 780
       Z"
    fill="url(#fire)"
  />

  <!-- Facet -->
  <path
    d="M150 410
       L252 595
       L150 780
       Z"
    fill="#ff9a18"
    opacity=".62"
  />

  <path
    d="M252 595 L330 595 L150 780 Z"
    fill="#a90017"
    opacity=".65"
  />

  <!-- Fine warm edge -->
  <path
    d="M145 175 H685
       C800 175 885 260 885 375"
    fill="none"
    stroke="#ffb21a"
    stroke-width="8"
    stroke-linecap="round"
    opacity=".8"
  />

  <path
    d="M330 405 H495 L855 825"
    fill="none"
    stroke="#ff9d19"
    stroke-width="7"
    stroke-linecap="round"
    opacity=".7"
  />
</svg>RENOBVA</div><p class="brand-sub">Web design & development</p></td><td><h1 class="document-title">${title}</h1><p class="number">${number}</p><span class="confirmed">PAYMENT CONFIRMED</span></td></tr></table></header><div class="accent"></div><main class="document-body"><p class="issue-line"><strong>Issued:</strong> ${escape(date(doc.issued_at))} &nbsp; / &nbsp; <strong>Currency:</strong> ${escape(doc.currency)}</p><table class="billing-table" role="presentation"><tr><td>${party('Issued by',s,'RENOBVA')}</td><td>${party('Issued to',b,'Client account')}</td></tr></table><table class="amount-table"><thead><tr><th scope="col">Agreed services</th><th scope="col">Paid amount</th></tr></thead><tbody><tr><td>Project payment</td><td>${amount}</td></tr></tbody></table><section class="description"><h2>Project & payment details</h2><p>${escape(doc.description)}</p></section><div class="total-wrap"><table class="total-table" role="presentation"><tr><td class="settled">Payment received<span>This payment has been confirmed.</span></td><td><small>Total paid</small><strong>${amount}</strong></td></tr></table></div>${s.tax_note?`<p class="tax-note">${escape(s.tax_note)}</p>`:''}<p class="payment-ref"><b>Payment reference</b><br>${escape(doc.payment_id)}</p>${!invoice?'<p class="receipt-note">Confirmation of payment. Billing details were incomplete when payment was confirmed.</p>':''}</main><footer class="document-footer"><strong>Thank you for choosing RENOBVA.</strong><p>Built with care. Made to stand out.</p></footer></article></body></html>`;
 }
 function paymentDocument(doc){
  const frame=document.createElement('iframe');frame.className='document-print-frame';frame.title=doc.document_type==='invoice'?'Invoice':'Payment receipt';
  document.body.appendChild(frame);
  frame.onload=async()=>{try{await frame.contentDocument.fonts.ready;}catch{}frame.contentWindow.focus();frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow.print();};
  frame.srcdoc=invoiceHtml(doc);
  setTimeout(()=>frame.remove(),600000);
 }
 return {escape,money,https,field,area,dialog,check,date,invoiceHtml,paymentDocument};
})();
