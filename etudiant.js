async function ressource(r) {
  const u = await lienFichier(r.chemin);
  if (r.type === "image") return `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="${esc(r.titre)}"></a>`;
  if (r.type === "video") return `<div><small>${esc(r.titre)}</small><video controls preload="metadata" src="${u}"></video></div>`;
  return `<a class="fichier" href="${u}" target="_blank" rel="noopener">📄 ${esc(r.titre)}</a>`;
}
(async () => {
  const p = await exiger("etudiant"); if (!p) return;
  $("nom").textContent = p.nom_complet || "Mon espace";
  if (p.niveau_id) {
    const { data } = await db.from("niveaux").select("nom").eq("id", p.niveau_id).single();
    $("niveau").textContent = data ? data.nom : "";
  } else $("niveau").textContent = "Niveau pas encore attribué par le docteur";
  const [m, n, v] = await Promise.all([
    db.from("modules").select("id,titre,description,ressources(id,titre,type,chemin)").order("titre"),
    db.from("notes").select("valeur,session,commentaire,modules(titre,coefficient)").eq("etudiant_id", p.id),
    db.from("pv").select("id,titre,chemin,created_at").order("created_at", { ascending: false })
  ]);
  const mods = m.data || [];
  const blocs = await Promise.all(mods.map(async x => {
    const res = (await Promise.all((x.ressources || []).map(ressource))).join("");
    return `<div class="bloc module"><h3>${esc(x.titre)}</h3>${x.description ? `<p>${esc(x.description)}</p>` : ""}${res || "<small>Aucun fichier pour l'instant.</small>"}</div>`;
  }));
  $("modules").innerHTML = blocs.join("") || "<p>Aucun module publié pour votre niveau.</p>";
  const notes = n.data || [];
  if (notes.length) {
    let s = 0, c = 0;
    notes.forEach(x => { const k = +(x.modules?.coefficient || 1); s += x.valeur * k; c += k; });
    $("notes").innerHTML = `<table><tr><th>Module</th><th>Session</th><th>Note /20</th></tr>${notes.map(x => `<tr><td>${esc(x.modules?.titre)}</td><td>${esc(x.session)}</td><td>${x.valeur}</td></tr>`).join("")}</table><p class="moy">Moyenne : ${(s / c).toFixed(2)} / 20</p>`;
  } else $("notes").innerHTML = "<p>Aucune note publiée.</p>";
  const pvs = await Promise.all((v.data || []).map(async x => `<li><a href="${await lienFichier(x.chemin)}" target="_blank" rel="noopener">${esc(x.titre)}</a> <small>${new Date(x.created_at).toLocaleDateString("fr-FR")}</small></li>`));
  $("pv").innerHTML = pvs.length ? `<ul>${pvs.join("")}</ul>` : "<p>Aucun PV publié.</p>";
})();
