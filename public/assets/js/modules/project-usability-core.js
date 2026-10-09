/* Pure helpers shared by project tabs, message badges and draft recovery. */
window.RENOBVA_USABILITY = (() => {
 const tabs=['overview','chat','files','payments','feedback','handover','activity'];
 const lifecycle=p=>p.deleted_at?'trash':p.archived_at?'archived':'current';
 const visible=(p,queue)=>queue==='trash'?!!p.deleted_at:queue==='archived'?!!p.archived_at&&!p.deleted_at:!p.deleted_at&&!p.archived_at;
 const unread=(messages,userId,receipt)=>messages.filter(m=>m.sender_id!==userId&&!m.deleted_at&&m.body!=='Project brief attachment'&&(!receipt||m.created_at>receipt)).length;
 const selectedTab=(value,admin)=>tabs.includes(value)&&(admin||value!=='activity')?value:'overview';
 const fields=form=>Object.fromEntries([...form.elements].filter(el=>el.name&&!el.disabled&&!['password','file','hidden','submit','button'].includes(el.type)).map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]));
 return {tabs,lifecycle,visible,unread,selectedTab,fields};
})();
