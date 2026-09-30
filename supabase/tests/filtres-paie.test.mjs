// Vérifie la logique de filtrage/totaux de PaiePage sur des données réalistes
import fs from 'node:fs'
import { transformWithOxc } from 'vite'

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


// ── Dates : le calcul doit rester local (le Maroc est en UTC+1) ──────────
const dateToIso = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const addDays = (d, n) => { const o = new Date(d); o.setDate(o.getDate() + n); return o }
const lendemain = (iso) => dateToIso(addDays(new Date(iso + 'T00:00:00'), 1))
const unAnApres = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  d.setFullYear(d.getFullYear() + 1)
  return dateToIso(addDays(d, -1))
}

ok('reprise = lendemain de la fin du congé', lendemain('2026-09-10') === '2026-09-11', lendemain('2026-09-10'))
ok('lendemain passe le changement de mois', lendemain('2026-09-30') === '2026-10-01', lendemain('2026-09-30'))
ok('lendemain passe le changement d’année', lendemain('2026-12-31') === '2027-01-01', lendemain('2026-12-31'))
ok('renouvellement : un an moins un jour', unAnApres('2026-07-01') === '2027-06-30', unAnApres('2026-07-01'))
ok('renouvellement sur année bissextile', unAnApres('2027-03-01') === '2028-02-29', unAnApres('2027-03-01'))
// La méthode fautive : toISOString() recule d'un jour dès que le fuseau est en avance
const fautif = (iso) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
const decalage = new Date().getTimezoneOffset() < 0
ok(decalage ? 'la méthode par toISOString aurait bien été fautive ici'
            : 'fuseau non décalé : les deux méthodes coïncident',
   decalage ? fautif('2026-09-10') !== '2026-09-11' : fautif('2026-09-10') === '2026-09-11',
   `toISOString donne ${fautif('2026-09-10')}`)


// ── Par quoi se range chaque mode de règlement ───────────────────────────
// La règle a déjà changé trois fois. On la vérifie sur le vrai module.
const { code: codeRegroupement } = await transformWithOxc(
  fs.readFileSync('src/lib/regroupementPaie.ts', 'utf8'), 'r.ts', { lang: 'ts' })
const { cleDuMode, libelleDuMode } = await import(
  'data:text/javascript;base64,' + Buffer.from(codeRegroupement).toString('base64'))

const unVirement = lignes[0] // HAY RIAD, annexe de LA COMMUNE, banque CIH
ok('le virement se range par site principal, pas par annexe',
   cleDuMode('Virement')(unVirement) === 'LA COMMUNE',
   cleDuMode('Virement')(unVirement))
ok('le versement se range par banque',
   cleDuMode('Versement')(unVirement) === 'CIH', cleDuMode('Versement')(unVirement))
ok('les espèces se rangent par annexe',
   cleDuMode('Espèces')(unVirement) === 'HAY RIAD', cleDuMode('Espèces')(unVirement))
ok('… et le libellé suit', libelleDuMode('Virement') === 'Site principal'
   && libelleDuMode('Versement') === 'Banque')

// Choisir un site principal en virement doit ramener TOUTES ses annexes.
const parPrincipal = new Map()
for (const l of lignes.filter((x) => x.mode_reglement === 'Virement')) {
  const k = cleDuMode('Virement')(l)
  parPrincipal.set(k, [...(parPrincipal.get(k) ?? []), l])
}
ok('un virement par site principal rassemble ses annexes',
   parPrincipal.get('LA COMMUNE')?.length === 1 && parPrincipal.get('ZONE NORD')?.length === 1,
   [...parPrincipal.keys()].join(', '))

// Sans rattachement, personne ne disparaît : il se range à part.
ok('sans site principal, la ligne se range à part',
   cleDuMode('Virement')({ site_principal_nom: null, site_nom: 'X' }) === '(sans site principal)')
ok('sans banque non plus',
   cleDuMode('Versement')({ banque: '  ' }) === '(BANQUE NON RENSEIGNÉE)')

// ── En-têtes : chaque société doit retrouver le sien ─────────────────────
// On charge le vrai module, pas une copie : une copie aurait continué à
// passer pendant que la vraie recherche perdait des sociétés en route.
const { code: codeEntetes } = await transformWithOxc(
  fs.readFileSync('src/lib/entetes.ts', 'utf8'), 'e.ts', { lang: 'ts' })
const { enteteDe, entreprisesAvecEntete } = await import(
  'data:text/javascript;base64,' + Buffer.from(codeEntetes).toString('base64'))

const SOCIETES = entreprisesAvecEntete()
ok('les dix sociétés ont un en-tête',
   SOCIETES.length === 10 && SOCIETES.every((s) => enteteDe(s).logo !== null),
   `${SOCIETES.length} société(s)`)
ok('les dix accents sont distincts',
   new Set(SOCIETES.map((s) => enteteDe(s).accent)).size === 10)
ok('la casse et les accents n’empêchent pas la correspondance',
   enteteDe('groupe triple a').accent === '#94040d'
   && enteteDe('Éden Vert Service').accent === '#366d81')
ok('une société inconnue retombe sur l’en-tête neutre',
   enteteDe('SOCIETE INEXISTANTE').logo === null)

// La raison sociale complète ne doit pas faire perdre son papier à une
// société : c'est ce qui arrivait, en silence, avant qu'on ne recolle
// les initiales pointées et qu'on ne laisse tomber la forme juridique.
const MEME_MAISON = [
  ['B.O NETTOYAGE S.A.R.L', 'BO'],
  ['TRIMAX SURVEILLANCE SARL', 'TRIMAX'],
  ['DUO MULTI SERVICE NV', 'DUO MULTI SERVICE'],
  ['SOCIETE SERCLEAN NEGOCE SARL', 'SERCLEAN NEGOCE'],
  ['COOPERATIVE EDEN VERT SERVICE', 'EDEN VERT SERVICE'],
  ['GROUPE TRIPLE AAA', 'GROUPE TRIPLE A'],
]
for (const [ecrit, officiel] of MEME_MAISON) {
  ok(`« ${ecrit} » retrouve ${officiel}`,
     enteteDe(ecrit).logo === enteteDe(officiel).logo
     && enteteDe(ecrit).logo !== null,
     enteteDe(ecrit).logo ?? 'aucun logo')
}

// Sept sociétés ont fourni leur papier à en-tête ; les trois autres
// s'impriment sur feuille blanche, et cela doit rester volontaire.
const AVEC_PAPIER = SOCIETES.filter((s) => enteteDe(s).papier)
ok('sept sociétés ont leur papier à en-tête', AVEC_PAPIER.length === 7,
   `${AVEC_PAPIER.length} : ${AVEC_PAPIER.join(', ')}`)
ok('… et la raison sociale complète le retrouve aussi',
   Boolean(enteteDe('B.O NETTOYAGE S.A.R.L').papier)
   && Boolean(enteteDe('TRIMAX SURVEILLANCE SARL').papier))

// Le relâchement ne doit pas rapprocher deux maisons différentes.
for (const nom of ['SERVICE SARL', 'SOCIETE GENERALE', 'MAROC TELECOM', 'NETTOYAGE SA']) {
  ok(`« ${nom} » reste sans en-tête`, enteteDe(nom).logo === null,
     enteteDe(nom).logo ?? '')
}

// Le point qui posait problème : imprimer un employé d'une AUTRE société.
const employes = [{ nom: 'A', company_id: 'c1' }, { nom: 'B', company_id: 'c2' }]
const societes = [{ id: 'c1', name: 'GROUPE TRIPLE A' }, { id: 'c2', name: 'EDEN VERT SERVICE' }]
const entrepriseDe = (e) => societes.find((c) => c.id === e.company_id)?.name ?? ''
ok('la fiche prend l’en-tête de la société de l’employé, pas celle affichée',
   enteteDe(entrepriseDe(employes[1])).accent === '#366d81',
   enteteDe(entrepriseDe(employes[1])).accent)
ok('… et non celle du premier employé',
   enteteDe(entrepriseDe(employes[0])).accent !== enteteDe(entrepriseDe(employes[1])).accent)

console.log(`\n=== ${P} réussis, ${F} échoués ===`)
process.exit(F ? 1 : 0)
