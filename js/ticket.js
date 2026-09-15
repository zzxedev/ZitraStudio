const Z=window.Zitra,$=s=>document.querySelector(s);
const ticketId=new URLSearchParams(location.search).get("id");
let me=null,isAdmin=false,ticket=null;

async function signed(path){
  const {data,error}=await Z.sb.storage.from("ticket-files").createSignedUrl(path,600);
  return error?null:data.signedUrl;
}
async function renderAttachments(rows,container){
  if(!rows?.length){container.innerHTML="";return}
  const html=[];
  for(const a of rows){
    const url=await signed(a.file_path);
    if(url) html.push(`<a class="fileLink" href="${Z.esc(url)}" target="_blank" rel="noopener">📎 ${Z.esc(a.file_name)}</a>`);
  }
  container.innerHTML=html.join("");
}
async function loadTicket(){
  const {data,error}=await Z.sb.from("tickets").select("*").eq("id",ticketId).single();
  if(error||!data){$("#ticketApp").classList.add("hidden");$("#notFound").classList.remove("hidden");return false}
  ticket=data;
  $("#ticketLabel").textContent=Z.ticketLabel(data.ticket_no);
  $("#ticketTitle").textContent=data.title;$("#ticketService").textContent=data.service;
  $("#customerName").textContent=data.customer_name;
  $("#customerContact").textContent=data.discord||data.email||"—";
  $("#budget").textContent=data.budget||"À discuter";$("#deadline").textContent=data.deadline||"Flexible";
  $("#createdAt").textContent=Z.date(data.created_at);$("#description").textContent=data.description;
  if(data.references_text){$("#refsWrap").classList.remove("hidden");$("#references").textContent=data.references_text}
  const pill=$("#statusPill");pill.className=`pill status-${data.status}`;pill.textContent=Z.statusLabel(data.status);
  $("#statusSelect").value=data.status;
  const {data:atts}=await Z.sb.from("ticket_attachments").select("*").eq("ticket_id",ticketId).is("message_id",null).order("created_at");
  await renderAttachments(atts,$("#rootAttachments"));
  return true;
}
async function loadMessages(){
  const {data,error}=await Z.sb.from("ticket_messages").select("id,author_id,body,is_internal,created_at").eq("ticket_id",ticketId).order("created_at");
  const wrap=$("#thread");if(error){wrap.innerHTML=`<div class="empty">Erreur de chargement.</div>`;return}
  if(!data.length){wrap.innerHTML=`<div class="empty">Aucun message pour le moment.</div>`;return}
  const {data:atts}=await Z.sb.from("ticket_attachments").select("*").eq("ticket_id",ticketId).not("message_id","is",null).order("created_at");
  const byMsg={};(atts||[]).forEach(a=>(byMsg[a.message_id]??=[]).push(a));
  wrap.innerHTML="";
  for(const m of data){
    const fromClient=m.author_id===ticket.user_id;
    const el=document.createElement("article");
    el.className=`message ${fromClient?"":"admin"} ${m.is_internal?"internal":""}`;
    el.innerHTML=`<div class="messageHead"><strong>${m.is_internal?"🔒 Note interne":(fromClient?Z.esc(ticket.customer_name):"ZitraDev")}</strong><time>${Z.esc(Z.date(m.created_at))}</time></div><div class="messageBody">${Z.esc(m.body)}</div><div class="attachments"></div>`;
    await renderAttachments(byMsg[m.id]||[],el.querySelector(".attachments"));
    wrap.appendChild(el);
  }
}
async function uploadFiles(messageId,files){
  for(const file of files){
    if(file.size>10*1024*1024) throw new Error(`${file.name} dépasse 10 Mo`);
    const safe=file.name.replace(/[^\w.\-]+/g,"_");
    const path=`${ticketId}/${crypto.randomUUID()}-${safe}`;
    const {error:e1}=await Z.sb.storage.from("ticket-files").upload(path,file);if(e1)throw e1;
    const {error:e2}=await Z.sb.from("ticket_attachments").insert({ticket_id:ticketId,message_id:messageId,uploader_id:me.id,file_path:path,file_name:file.name,file_size:file.size});if(e2)throw e2;
  }
}
async function boot(){
  if(!Z.configured)return;
  me=await Z.user();
  if(!me){$("#loginGate").classList.remove("hidden");return}
  $("#logoutBtn").classList.remove("hidden");$("#logoutBtn").onclick=()=>Z.logout();
  isAdmin=await Z.admin();
  if(isAdmin){$("#adminBtn").classList.remove("hidden");$("#adminControls").classList.remove("hidden");$("#internalWrap").classList.remove("hidden")}
  $("#ticketApp").classList.remove("hidden");
  if(await loadTicket()) await loadMessages();
}
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const email=$("#loginEmail").value.trim();
  const {error}=await Z.magic(email,location.href);
  $("#loginMsg").textContent=error?"Impossible d'envoyer le lien.":"Lien envoyé. Vérifie ta boîte mail.";
  $("#loginMsg").className=`notice show ${error?"err":"ok"}`;
});
$("#refreshBtn").onclick=async()=>{await loadTicket();await loadMessages()};
$("#sendBtn").onclick=async()=>{
  const body=$("#replyText").value.trim(),err=$("#replyErr");err.classList.remove("show");if(!body)return;
  const btn=$("#sendBtn");btn.disabled=true;btn.textContent="Envoi...";
  try{
    const internal=isAdmin&&$("#internalCheck").checked;
    const {data,error}=await Z.sb.from("ticket_messages").insert({ticket_id:ticketId,author_id:me.id,body,is_internal:internal}).select("id").single();
    if(error)throw error;
    await uploadFiles(data.id,[...$("#replyFiles").files]);
    $("#replyText").value="";$("#replyFiles").value="";if(isAdmin)$("#internalCheck").checked=false;
    await loadMessages();await loadTicket();
  }catch(ex){err.textContent=ex.message||"Impossible d'envoyer.";err.classList.add("show")}
  finally{btn.disabled=false;btn.textContent="Envoyer →"}
};
$("#saveStatus").onclick=async()=>{
  const value=$("#statusSelect").value,btn=$("#saveStatus");btn.disabled=true;
  const {error}=await Z.sb.from("tickets").update({status:value}).eq("id",ticketId);
  btn.disabled=false;if(!error)await loadTicket();else alert(error.message);
};
boot();
