const Z=window.Zitra, $=s=>document.querySelector(s);
$("#year").textContent=new Date().getFullYear();

async function uploadFiles(ticketId, messageId, files){
  if(!files || !files.length) return;
  for(const file of files){
    if(file.size > 10*1024*1024) throw new Error(`${file.name} dépasse 10 Mo`);
    const safe=file.name.replace(/[^\w.\-]+/g,"_");
    const path=`${ticketId}/${crypto.randomUUID()}-${safe}`;
    const {error:upErr}=await Z.sb.storage.from("ticket-files").upload(path,file);
    if(upErr) throw upErr;
    const {error:dbErr}=await Z.sb.from("ticket_attachments").insert({
      ticket_id:ticketId,message_id:messageId||null,uploader_id:(await Z.user()).id,
      file_path:path,file_name:file.name,file_size:file.size
    });
    if(dbErr) throw dbErr;
  }
}

async function loadTickets(){
  const list=$("#ticketList");
  const {data,error}=await Z.sb.from("tickets").select("id,ticket_no,title,service,status,created_at,updated_at").order("updated_at",{ascending:false});
  if(error){list.innerHTML=`<div class="empty">Erreur de chargement.</div>`;return}
  if(!data.length){list.innerHTML=`<div class="empty">Aucun ticket pour le moment.</div>`;return}
  list.innerHTML=data.map(t=>`
    <a class="ticketCard" href="ticket.html?id=${encodeURIComponent(t.id)}">
      <div><h3>${Z.esc(Z.ticketLabel(t.ticket_no))} — ${Z.esc(t.title)}</h3>
      <div class="ticketMeta"><span>${Z.esc(t.service)}</span><span>Créé ${Z.esc(Z.date(t.created_at))}</span><span>Mis à jour ${Z.esc(Z.date(t.updated_at))}</span></div></div>
      <span class="pill status-${Z.esc(t.status)}">${Z.esc(Z.statusLabel(t.status))}</span>
    </a>`).join("");
}

async function boot(){
  if(!Z.configured) return;
  const user=await Z.user();
  if(!user){
    $("#authSection").classList.remove("hidden");
    $("#clientSection").classList.add("hidden");
    return;
  }
  $("#authSection").classList.add("hidden");
  $("#clientSection").classList.remove("hidden");
  $("#clientEmail").textContent=user.email;
  $("#logoutBtn").classList.remove("hidden");
  $("#logoutBtn").onclick=()=>Z.logout();
  if(await Z.admin()) $("#adminBtn").classList.remove("hidden");
  await loadTickets();
}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  $("#loginOk").classList.remove("show");
  $("#loginErr").classList.remove("show");
  if(!Z.configured){
    $("#loginErr").textContent="Configure d'abord Supabase.";
    $("#loginErr").classList.add("show");
    return;
  }
  const email=$("#loginEmail").value.trim();
  const {error}=await Z.magic(email,location.href.split("#")[0]);
  (error?$("#loginErr"):$("#loginOk")).classList.add("show");
});

document.querySelectorAll(".serviceCard").forEach(c=>c.addEventListener("click",()=>{
  $("#serviceSelect").value=c.dataset.service;
  $("#newTicket").scrollIntoView({behavior:"smooth"});
}));

$("#ticketForm").addEventListener("submit",async e=>{
  e.preventDefault();

  // IMPORTANT : on capture le formulaire et ses données AVANT le premier await.
  // e.currentTarget devient null après une attente asynchrone dans certains navigateurs.
  const form = e.currentTarget;
  const fd = new FormData(form);

  const err=$("#createErr");
  err.classList.remove("show");
  const btn=$("#createBtn");
  btn.disabled=true;
  btn.textContent="Création...";

  try{
    const user=await Z.user();
    if(!user) throw new Error("Session expirée");

    const payload={
      user_id:user.id,
      email:user.email,
      customer_name:String(fd.get("customer_name") || "").trim(),
      discord:String(fd.get("discord") || "").trim(),
      service:fd.get("service"),
      title:String(fd.get("title") || "").trim(),
      budget:fd.get("budget"),
      deadline:fd.get("deadline"),
      description:String(fd.get("description") || "").trim(),
      references_text:String(fd.get("references_text") || "").trim()
    };

    const {data,error}=await Z.sb
      .from("tickets")
      .insert(payload)
      .select("id")
      .single();

    if(error) throw error;

    await uploadFiles(data.id,null,[...$("#createFiles").files]);

    location.href=`ticket.html?id=${encodeURIComponent(data.id)}`;
  }catch(ex){
    err.textContent=ex.message||"Impossible de créer le ticket.";
    err.classList.add("show");
    btn.disabled=false;
    btn.textContent="Créer le ticket →";
  }
});

boot();
