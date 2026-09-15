const Z=window.Zitra,$=s=>document.querySelector(s);let all=[];
function draw(){
  const q=$("#search").value.trim().toLowerCase(),st=$("#statusFilter").value;
  const rows=all.filter(t=>(!st||t.status===st)&&(!q||[
    Z.ticketLabel(t.ticket_no),t.customer_name,t.email,t.discord,t.title,t.service
  ].join(" ").toLowerCase().includes(q)));
  $("#ticketList").innerHTML=rows.length?rows.map(t=>`
    <a class="ticketCard" href="ticket.html?id=${encodeURIComponent(t.id)}">
      <div><h3>${Z.esc(Z.ticketLabel(t.ticket_no))} — ${Z.esc(t.title)}</h3>
      <div class="ticketMeta"><span>${Z.esc(t.customer_name)}</span><span>${Z.esc(t.service)}</span><span>${Z.esc(t.budget||"À discuter")}</span><span>Maj ${Z.esc(Z.date(t.updated_at))}</span></div></div>
      <span class="pill status-${Z.esc(t.status)}">${Z.esc(Z.statusLabel(t.status))}</span>
    </a>`).join(""):`<div class="empty">Aucun ticket correspondant.</div>`;
}
async function load(){
  const {data,error}=await Z.sb.from("tickets").select("*").order("updated_at",{ascending:false});
  if(error){$("#ticketList").innerHTML=`<div class="empty">${Z.esc(error.message)}</div>`;return}
  all=data;
  const c=s=>data.filter(t=>t.status===s).length;
  $("#sNew").textContent=c("new");$("#sProgress").textContent=c("in_progress");$("#sWaiting").textContent=c("waiting_client");$("#sCompleted").textContent=c("completed");$("#sClosed").textContent=c("closed");
  draw();
}
async function boot(){
  if(!Z.configured)return;
  const u=await Z.user();if(!u){$("#loginGate").classList.remove("hidden");return}
  $("#logoutBtn").classList.remove("hidden");$("#logoutBtn").onclick=()=>Z.logout();
  if(!(await Z.admin())){$("#denied").classList.remove("hidden");return}
  $("#adminApp").classList.remove("hidden");$("#adminEmail").textContent=u.email;await load();
}
$("#loginForm").onsubmit=async e=>{e.preventDefault();const {error}=await Z.magic($("#loginEmail").value.trim(),location.href);$("#loginMsg").textContent=error?"Erreur : "+error.message:"Lien envoyé. Vérifie ta boîte mail.";$("#loginMsg").className=`notice show ${error?"err":"ok"}`};
$("#deniedLogout").onclick=()=>Z.logout();
$("#search").oninput=draw;$("#statusFilter").onchange=draw;
boot();
