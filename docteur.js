let P, niveaux = [], modules = [];
const onglets = ["niveaux", "etudiants", "modules", "notes", "pv"];
const opt = (a, k = "nom") => a.map(x => `<option value="${x.id}">${esc(x[k])}</option>`).join("");
const nomNiveau = id => (niveaux.find(n => n.id === id) || {}).nom || "—";
function montrer(n) { onglets.forEach(o => { $("s-" + o).hidden = o !== n; $("t-" + o).classList.toggle("actif", o === n); }); }

async function tout() {
  niveaux = (await db.from("niveaux").select("*").order("nom")).data || [];
  modules = (await db.from("modules").select("*").order("titre")).data || [];
  ["m-niveau", "n-niveau", "p-niveau"].forEach(i => { const v = $(i).value; $(i).innerHTML = opt(niveaux); if (v) $(i).value = v; });
  $("r-module").innerHTML = modules.map(m => `<option value="${m.id}">${esc(nomNiveau(m.niveau_id))} : ${esc(m.titre)}</option>`).join("");
  $("l-niveaux").innerHTML = niveaux.map(n => `<li>${esc(n.nom)} <button class="mini" onclick="supp('niveaux','${n.id}')">Supprimer</button></li>`).join("") || "<li>Aucun niveau. Ajoutez le premier.</li>";
  await Promise.all([lEtudiants(), lModules(), lNotes(), lPV()]);
}
async function supp(t, id) {
  if (!confirm("Supprimer définitivement ?")) return;
  const { error } = await db.from(t).delete().eq("id", id);
  if (error) return msg(error.message);
  await tout();
}
async function ajNiveau() {
  const nom = $("niv-nom").value.trim(); if (!nom) return;
  const { error } = await db.from("niveaux").insert({ nom });
  if (error) return msg(error.message);
  $("niv-nom").value = ""; msg("Niveau ajouté", true); await tout();
}

async function lEtudiants() {
  const { data } = await db.from("profils").select("*").eq("role", "etudiant").order("nom_complet");
  $("l-etudiants").innerHTML = (data || []).map(e => `<tr><td>${esc(e.nom_complet)}</td>
<td><input value="${esc(e.matricule || "")}" placeholder="Matricule" onchange="majEtu('${e.id}',{matricule:this.value})"></td>
<td><select onchange="majEtu('${e.id}',{niveau_id:this.value||null})"><option value="">Aucun niveau</option>${opt(niveaux).replace(`value="${e.niveau_id}"`, `value="${e.niveau_id}" selected`)}</select></td></tr>`).join("") || "<tr><td>Aucun étudiant inscrit.</td></tr>";
}
async function majEtu(id, champs) {
  const { error } = await db.from("profils").update(champs).eq("id", id);
  msg(error ? error.message : "Enregistré", !error);
  if (!error) { lNotes(); lPV(); }
}

async function ajModule() {
  const niveau_id = $("m-niveau").value, titre = $("m-titre").value.trim();
  if (!niveau_id || !titre) return msg("Choisissez un niveau et saisissez un titre.");
  const { error } = await db.from("modules").insert({ niveau_id, titre, description: $("m-desc").value.trim() || null, coefficient: +$("m-coef").value || 1 });
  if (error) return msg(error.message);
  $("m-titre").value = ""; $("m-desc").value = ""; msg("Module ajouté", true); await tout();
}
async function ajRessource() {
  const f = $("r-fichier").files[0], m = modules.find(x => x.id === $("r-module").value);
  if (!m || !f) return msg("Choisissez un module et un fichier.");
  const titre = $("r-titre").value.trim() || f.name;
  const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "pdf";
  const chemin = `${m.niveau_id}/${m.id}/${Date.now()}_${nomSur(f.name)}`;
  try {
    msg("Envoi en cours…", true);
    await televerser(chemin, f);
    const { error } = await db.from("ressources").insert({ module_id: m.id, titre, type, chemin });
    if (error) throw error;
    $("r-fichier").value = ""; $("r-titre").value = ""; msg("Fichier publié", true); await tout();
  } catch (e) { msg(e.message); }
}
async function lModules() {
  const { data } = await db.from("ressources").select("*");
  $("l-modules").innerHTML = modules.map(m => `<div class="bloc"><b>${esc(nomNiveau(m.niveau_id))} : ${esc(m.titre)}</b> <button class="mini" onclick="supp('modules','${m.id}')">Supprimer</button><ul>${(data || []).filter(r => r.module_id === m.id).map(r => `<li>${esc(r.titre)} (${r.type}) <button class="mini" onclick="suppRes('${r.id}','${esc(r.chemin)}')">Retirer</button></li>`).join("")}</ul></div>`).join("") || "<p>Aucun module. Ajoutez le premier ci-dessus.</p>";
}
async function suppRes(id, chemin) {
  if (!confirm("Retirer ce fichier ?")) return;
  await db.storage.from("cours").remove([chemin]);
  await db.from("ressources").delete().eq("id", id);
  await tout();
}

async function lNotes() {
  const nid = $("n-niveau").value, ms = modules.filter(m => m.niveau_id === nid), cur = $("n-module").value;
  $("n-module").innerHTML = opt(ms, "titre");
  if (ms.some(m => m.id === cur)) $("n-module").value = cur;
  const mid = $("n-module").value, ses = $("n-session").value;
  if (!nid || !mid) { $("l-notes").innerHTML = "<tr><td>Choisissez un niveau qui a au moins un module.</td></tr>"; return; }
  const [e, n] = await Promise.all([
    db.from("profils").select("id,nom_complet").eq("role", "etudiant").eq("niveau_id", nid).order("nom_complet"),
    db.from("notes").select("etudiant_id,valeur").eq("module_id", mid).eq("session", ses)
  ]);
  const map = Object.fromEntries((n.data || []).map(x => [x.etudiant_id, x.valeur]));
  $("l-notes").innerHTML = (e.data || []).map(s => `<tr><td>${esc(s.nom_complet)}</td><td><input type="number" min="0" max="20" step="0.25" data-id="${s.id}" value="${map[s.id] ?? ""}"></td></tr>`).join("") || "<tr><td>Aucun étudiant dans ce niveau.</td></tr>";
}
async function saveNotes() {
  const module_id = $("n-module").value, session = $("n-session").value;
  const rows = [...document.querySelectorAll("#l-notes input[data-id]")].filter(i => i.value !== "").map(i => ({ etudiant_id: i.dataset.id, module_id, session, valeur: +i.value }));
  if (!rows.length) return msg("Saisissez au moins une note.");
  const { error } = await db.from("notes").upsert(rows, { onConflict: "etudiant_id,module_id,session" });
  msg(error ? error.message : "Notes enregistrées", !error);
}

async function lPV() {
  const nid = $("p-niveau").value, cur = $("p-etudiant").value;
  const e = nid ? (await db.from("profils").select("id,nom_complet").eq("role", "etudiant").eq("niveau_id", nid).order("nom_complet")).data || [] : [];
  $("p-etudiant").innerHTML = `<option value="">Tout le niveau</option>` + opt(e, "nom_complet");
  $("p-etudiant").value = cur;
  const { data } = await db.from("pv").select("*").order("created_at", { ascending: false });
  $("l-pv").innerHTML = (data || []).map(x => `<li>${esc(nomNiveau(x.niveau_id))} : ${esc(x.titre)}${x.etudiant_id ? " (individuel)" : ""} <button class="mini" onclick="suppPV('${x.id}','${esc(x.chemin)}')">Retirer</button></li>`).join("") || "<li>Aucun PV publié.</li>";
}
async function ajPV() {
  const niveau_id = $("p-niveau").value, etudiant_id = $("p-etudiant").value || null, f = $("p-fichier").files[0];
  if (!niveau_id || !f) return msg("Choisissez un niveau et un fichier.");
  const titre = $("p-titre").value.trim() || f.name, chemin = `${etudiant_id || niveau_id}/pv/${Date.now()}_${nomSur(f.name)}`;
  try {
    await televerser(chemin, f);
    const { error } = await db.from("pv").insert({ niveau_id, etudiant_id, titre, chemin });
    if (error) throw error;
    $("p-fichier").value = ""; $("p-titre").value = ""; msg("PV publié", true); await lPV();
  } catch (e) { msg(e.message); }
}
async function suppPV(id, chemin) {
  if (!confirm("Retirer ce PV ?")) return;
  await db.storage.from("cours").remove([chemin]);
  await db.from("pv").delete().eq("id", id);
  await lPV();
}

(async () => {
  P = await exiger("docteur"); if (!P) return;
  $("qui").textContent = P.nom_complet || "";
  montrer("niveaux"); await tout();
})();
