(function(){
  const cfg = window.ZITRA_CONFIG || {};
  const bad = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes("YOUR_PROJECT") || cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  window.Zitra = {
    configured: !bad,
    sb: null,
    statusLabel(status){
      return {
        new:"Nouveau",in_progress:"En cours",waiting_client:"En attente client",
        completed:"Terminé",closed:"Fermé"
      }[status] || status;
    },
    ticketLabel(n){ return "#ZX-" + String(n || 0).padStart(5,"0"); },
    date(v){ return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)); },
    esc(v){ const d=document.createElement("div"); d.textContent=v??""; return d.innerHTML; },
    async user(){
      if(!this.sb) return null;
      const {data} = await this.sb.auth.getUser();
      return data.user || null;
    },
    async admin(){
      if(!this.sb) return false;
      const {data,error}=await this.sb.rpc("is_admin");
      return !error && data === true;
    },
    async magic(email, redirectTo){
      return this.sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo || location.href}});
    },
    async logout(){ if(this.sb) await this.sb.auth.signOut(); location.href="index.html"; },
    setupBanner(){
      if(this.configured) return;
      const el=document.createElement("div");
      el.className="setupBanner";
      el.innerHTML="<strong>Configuration requise :</strong> renseigne SUPABASE_URL et SUPABASE_ANON_KEY dans <code>js/config.js</code>, puis exécute <code>supabase_schema.sql</code> dans Supabase.";
      document.body.insertBefore(el, document.body.children[1] || null);
    }
  };
  if(!bad){
    window.Zitra.sb = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  }
  window.addEventListener("DOMContentLoaded",()=>window.Zitra.setupBanner());
})();
