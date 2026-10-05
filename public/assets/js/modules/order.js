
const type=document.querySelector("#serviceType"),dynamic=document.querySelector("#dynamicQuestions");
const questions={
 "Business Website":["Business / brand name","What does your business do?","Which pages do you need?","Websites/styles you like"],
 "Full-Stack Project":["What should users be able to do?","Do users need accounts?","Which dashboard features do you need?","Any database/integration requirements?"],
 "Birthday Website":["Recipient name","Birthday date","Relationship to recipient","Music / voice / games / gift hunt?"],
 "Anniversary / Love":["Names","Anniversary date","Your story in a few sentences","Favorite memories / songs"],
 "Mother's Day":["Recipient name","Favorite memories","Messages you want included","Photos / voice messages?"],
 "Wedding / Proposal":["Names","Event/proposal date","Proposal or wedding site?","RSVP / location / story requirements"],
 "Custom Celebration":["Occasion","Recipient","Event date","Describe the surprise you imagine"]
};
function draw(){dynamic.innerHTML=(questions[type.value]||[]).map((q,i)=>`<label>${q}<textarea name="q${i}" required></textarea></label>`).join("")}
type.addEventListener("change",draw);draw();
document.querySelector("#orderForm").addEventListener("submit",async e=>{
 e.preventDefault();const ctx=await requireAuth();if(!ctx)return;
 const fd=new FormData(e.target),answers={};[...(questions[type.value]||[])].forEach((q,i)=>answers[q]=fd.get("q"+i));
 const category=["Birthday Website","Anniversary / Love","Mother's Day","Wedding / Proposal","Custom Celebration"].includes(type.value)?"special":"business";
 const {data,error}=await renobva.sb.from("projects").insert({user_id:ctx.user.id,title:fd.get("title"),service_type:type.value,category,budget:fd.get("budget"),deadline:fd.get("deadline")||null,brief:fd.get("brief"),answers,status:"new"}).select().single();
 if(error)return toast(error.message,"error");toast("Project request created.");setTimeout(()=>location.href="project.html?id="+data.id,600)
});
