
(async()=>{
 const ctx=await requireAuth();if(!ctx)return;
 const f=document.querySelector("#profileForm");f.display_name.value=ctx.profile?.display_name||"";
 const av=document.querySelector("#settingsAvatar");
 if(ctx.profile?.avatar_url){av.innerHTML=`<img src="${ctx.profile.avatar_url}" alt="">`}
 document.querySelector("#avatarFile")?.addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024)return toast("Profile picture must be under 5 MB.","warn");
  const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"");
  const path=`avatars/${ctx.user.id}/profile.${ext}`;
  const {error:up}=await renobva.sb.storage.from("project-files").upload(path,file,{upsert:true,contentType:file.type});
  if(up)return toast(up.message,"error");
  const {data}=await renobva.sb.storage.from("project-files").createSignedUrl(path,31536000);
  const url=data?.signedUrl;if(!url)return toast("Could not create profile image URL.","error");
  const {error}=await renobva.sb.from("profiles").update({avatar_url:url}).eq("id",ctx.user.id);
  if(error)return toast(error.message,"error");av.innerHTML=`<img src="${url}" alt="">`;toast("Profile picture updated.");
 });
 f.addEventListener("submit",async e=>{e.preventDefault();let {error}=await renobva.sb.from("profiles").update({display_name:f.display_name.value}).eq("id",ctx.user.id);toast(error?error.message:"Profile updated.",error?"error":"ok")});
 document.querySelector("#passwordForm").addEventListener("submit",async e=>{e.preventDefault();let {error}=await renobva.sb.auth.updateUser({password:e.target.password.value});toast(error?error.message:"Password updated.",error?"error":"ok");if(!error)e.target.reset()});
})();
