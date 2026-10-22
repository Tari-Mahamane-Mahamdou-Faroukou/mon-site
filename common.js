const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nomSur = n => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
function msg(t, ok) { const e = $("msg"); e.textContent = t; e.className = ok ? "ok" : "err"; }
async function profilCourant() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const { data } = await db.from("profils").select("*").eq("id", session.user.id).single();
  return data;
}
async function exiger(role) {
  const p = await profilCourant();
  if (!p) { location.href = "index.html"; return null; }
  if (p.role !== role) { location.href = p.role === "docteur" ? "docteur.html" : "etudiant.html"; return null; }
  return p;
}
async function deconnexion() { await db.auth.signOut(); location.href = "index.html"; }
async function lienFichier(chemin) {
  const { data } = await db.storage.from("cours").createSignedUrl(chemin, 3600);
  return data ? data.signedUrl : "#";
}
async function televerser(chemin, fichier) {
  const { error } = await db.storage.from("cours").upload(chemin, fichier, { upsert: false });
  if (error) throw error;
}
