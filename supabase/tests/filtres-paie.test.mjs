// Vérifie la logique de filtrage/totaux de PaiePage sur des données réalistes
const lignes = [
  { nom_prenom:'A', matricule:1, site_nom:'HAY RIAD', site_principal_nom:'LA COMMUNE', mode_reglement:'Virement', banque:'CIH',  salaire_brut:5200, prime:0,   retenue_dette:500, autres_retenues:0, net_a_payer:4700 },
  { nom_prenom:'B', matricule:2, site_nom:'HAY RIAD', site_principal_nom:'LA COMMUNE', mode_reglement:'Espece',   banque:null,   salaire_brut:3000, prime:200, retenue_dette:0,   autres_retenues:0, net_a_payer:3200 },
  { nom_prenom:'C', matricule:3, site_nom:'AGDAL',    site_principal_nom:'LA COMMUNE', mode_reglement:'Espece',   banque:null,   salaire_brut:2500, prime:0,   retenue_dette:0,   autres_retenues:100, net_a_payer:2400 },
  { nom_prenom:'D', matricule:4, site_nom:'PORT',     site_principal_nom:'ZONE NORD',  mode_reglement:'Virement', banque:'BMCE', salaire_brut:4000, prime:0,   retenue_dette:0,   autres_retenues:0, net_a_payer:4000 },
  { nom_prenom:'E', matricule:5, site_nom:'PORT',     site_principal_nom:'ZONE NORD',  mode_reglement:'Versement',banque:null,   salaire_brut:3500, prime:0,   retenue_dette:0,   autres_retenues:0, net_a_payer:3500 },
]
const estVirement = m => (m ?? '').toLowerCase().startsWith('vir')
const filtrer = (r='', reg='', site='', princ='') => lignes.filter(l => {
  if (reg && (l.mode_reglement ?? '') !== reg) return false
  if (site && (l.site_nom ?? '') !== site) return false
  if (princ && (l.site_principal_nom ?? '') !== princ) return false
  if (!r) return true
  const q = r.toLowerCase()
  return (
    l.nom_prenom.toLowerCase().includes(q) ||
    String(l.matricule ?? '').includes(q) ||
    (l.site_nom ?? '').toLowerCase().includes(q)
  )
})
const tot = f => ({
  employes: f.length,
  net: f.reduce((s,l)=>s+l.net_a_payer,0),
  virement: f.filter(l=>estVirement(l.mode_reglement)).reduce((s,l)=>s+l.net_a_payer,0),
  especes:  f.filter(l=>!estVirement(l.mode_reglement)).reduce((s,l)=>s+l.net_a_payer,0),
})
let P = 0, F = 0
const ok = (n, c, x = '') => {
  if (c) { P++; console.log('  ✓ ' + n) }
  else   { F++; console.log('  ✗ ' + n + ' ' + x) }
}

let t=tot(filtrer())
ok('sans filtre : 5 employés, net 17 800', t.employes===5 && t.net===17800, JSON.stringify(t))
ok('espèces vs virement se complètent', t.virement+t.especes===t.net, JSON.stringify(t))

t=tot(filtrer('', 'Espece'))
ok('seulement les espèces : 2 personnes, 5 600 DH', t.employes===2 && t.net===5600, JSON.stringify(t))

t=tot(filtrer('', 'Virement'))
ok('seulement les virements : 2 personnes, 8 700 DH', t.employes===2 && t.net===8700, JSON.stringify(t))

t=tot(filtrer('', 'Versement'))
ok('seulement les versements : 1 personne, 3 500 DH', t.employes===1 && t.net===3500, JSON.stringify(t))

t=tot(filtrer('', '', 'PORT'))
ok('une seule annexe (PORT) : 7 500 DH', t.employes===2 && t.net===7500, JSON.stringify(t))

t=tot(filtrer('', '', '', 'LA COMMUNE'))
ok('un site principal (LA COMMUNE) regroupe ses 2 annexes : 3 personnes, 10 300 DH',
   t.employes===3 && t.net===10300, JSON.stringify(t))

t=tot(filtrer('', 'Espece', '', 'LA COMMUNE'))
ok('combiné — espèces DANS LA COMMUNE : 2 personnes, 5 600 DH',
   t.employes===2 && t.net===5600, JSON.stringify(t))

// somme des sites principaux = total général
const somme = ['LA COMMUNE','ZONE NORD'].reduce((s,p)=>s+tot(filtrer('','','',p)).net,0)
ok('la somme des sites principaux redonne le total', somme===17800, String(somme))

// répartition par banque sur les virements
const parBanque = Object.entries(filtrer('','Virement').reduce((a,l)=>{
  const b=(l.banque??'').trim()||'(non renseignée)'; a[b]=(a[b]??0)+l.net_a_payer; return a},{}))
ok('détail par banque : CIH 4 700 + BMCE 4 000',
   JSON.stringify(Object.fromEntries(parBanque))==='{"CIH":4700,"BMCE":4000}',
   JSON.stringify(parBanque))

console.log(`\n=== ${P} réussis, ${F} échoués ===`)
process.exit(F?1:0)
