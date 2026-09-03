// Les modèles de contrat : un texte figé, des champs déclarés, aucun jeton
// orphelin. Une erreur ici sortirait sur un document signé chez le notaire.
import fs from 'node:fs'

const src = fs.readFileSync(new URL('../../src/lib/contratsModeles.ts', import.meta.url), 'utf8')
let P = 0, F = 0
const ok = (n, c, d = '') => { c ? (P++, console.log('  ✓ ' + n)) : (F++, console.log('  ✗ ' + n + (d ? '  → ' + d : ''))) }

// Megainter s'écrit avec un i sur ses papiers ; l'autre graphie est un
// alias, vérifié plus bas.
const SOCIETES = ['BO', 'DUO MULTI SERVICE', 'GROUPE TRIPLE A', 'MEGAINTER SERVICE MAROC',
  'NORD PLANET', 'TRIMAX', 'SERCLEAN NEGOCE', 'VIGILMA GARD MAROC',
  'AL SAFAE EL MAGHREB', 'EDEN VERT SERVICE']

console.log('\n  ── Registre des modèles ───────────────────────────────')
for (const s of SOCIETES) {
  ok(`${s} a un modèle`, src.includes(`'${s}': `) || src.includes(`'${s}':`), s)
}

console.log('\n  ── Jetons et champs ───────────────────────────────────')
// Tout jeton {{x}} du texte doit correspondre à un champ déclaré quelque part.
// Les commentaires sont écartés : ils citent la syntaxe sans l'employer.
const sansCommentaires = src
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n')
const jetons = new Set([...sansCommentaires.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
const champsDeclares = new Set([
  ...[...src.matchAll(/id:\s*'(\w+)'/g)].map((m) => m[1]),
  ...[...src.matchAll(/const (NOM|CIN|NAISSANCE|ADRESSE|DEBUT|FIN|SALAIRE|MARCHE|FAIT_A|FAIT_LE)/g)].map(() => null),
].filter(Boolean))
const orphelins = [...jetons].filter((j) => !champsDeclares.has(j))
ok('aucun jeton sans champ déclaré', orphelins.length === 0, orphelins.join(', '))
ok('les jetons attendus sont présents',
   ['nom', 'cin', 'naissance', 'adresse', 'debut', 'fin', 'salaire', 'marche', 'fait_a', 'fait_le']
     .every((j) => jetons.has(j)))

console.log('\n  ── Ce que ces documents ne doivent PAS porter ─────────')
ok('aucun logo, aucun en-tête dans le document',
   !fs.readFileSync(new URL('../../src/components/ContratDocument.tsx', import.meta.url), 'utf8')
      .match(/enteteDe|entete\.logo|<img/))

console.log('\n  ── Arabe ──────────────────────────────────────────────')
const doc = fs.readFileSync(new URL('../../src/components/ContratDocument.tsx', import.meta.url), 'utf8')
ok('le document bascule en droite-à-gauche', doc.includes(`dir={arabe ? 'rtl' : 'ltr'}`))
ok('chaque valeur est isolée séparément, pas le paragraphe entier',
   doc.includes('<bdi key={i}>{valeur}</bdi>'))
ok('les champs de saisie s’orientent d’après ce qu’on tape',
   fs.readFileSync(new URL('../../src/components/ContratRedaction.tsx', import.meta.url), 'utf8')
     .includes('dir="auto"'))
ok('un contrat arabe ne préremplit pas les données latines du registre',
   fs.readFileSync(new URL('../../src/components/ContratRedaction.tsx', import.meta.url), 'utf8')
     .includes("LATIN_SEULEMENT"))
ok('les deux graphies de Megainter mènent au même modèle',
   src.includes("PAR_CLE.set(cle('MEGANTER SERVICE MAROC')"))
ok('les deux contrats arabes sont enregistrés',
   src.includes("'AL SAFAE EL MAGHREB': familleD") && src.includes("'EDEN VERT SERVICE': familleD"))

console.log('\n  ── Fidélité au texte fourni ───────────────────────────')
for (const [quoi, phrase] of [
  ['la clause de l’article 20 du code du travail', 'article 20 du code du travail'],
  ['la clause de l’article 39 du code du travail', 'article 39 du code du travail'],
  ['la grossesse dès le 2ème mois', 'En cas de grossesse dès le 2ème mois'],
  ['le SMIG dans les contrats de projet', 'Salaire Minimum Interprofessionnel Garanti (SMIG)'],
  ['la signature légalisée', 'PS : Signature légalisée'],
  ['la période d’essai de huit jours (arabe)', 'ثمانية أيام'],
  ['la compétence juridictionnelle marocaine', 'juridictions marocaines compétentes'],
  ['l’orthographe MEGAINTER du papier', 'MEGAINTER SERVICE MAROC'],
]) ok(quoi + ' est reprise', src.includes(phrase))

console.log('\n  ── Engagement de congé ────────────────────────────────')
const detail0 = fs.readFileSync(new URL('../../src/pages/validator/EmployeDetail.tsx', import.meta.url), 'utf8')
const eng = fs.readFileSync(new URL('../../src/lib/engagementConge.ts', import.meta.url), 'utf8')
ok('l’engagement est en arabe', eng.includes("langue: 'ar'"))
ok('le titre est « التزام »', eng.includes("titre: 'التزام'"))
for (const [quoi, phrase] of [
  ['la formule d’ouverture', 'انا الموقع اسفله'],
  ['la mention de la carte nationale', 'الحامل لبطاقة التعريف الوطنية رقم'],
  ['la déclaration sur l’honneur', 'أصرح بشرفي وأنا في كامل قواي العقلية'],
  ['le congé annuel', 'استفدت من عطلتي السنوية'],
  ['les dates de début et de fin', 'التي تبدأ من {{debut}} وتنتهي يوم {{fin}}'],
  ['la signature', "gauche: 'التوقيع'"],
]) ok(quoi + ' est reprise', eng.includes(phrase))
ok('la société et son siège sont préremplis', eng.includes('defauts:'))

console.log('\n  ── Un contrat arabe peut être rempli ──────────────────')
ok('le nom, le domicile et le lieu de signature s’y saisissent en arabe',
   src.includes("label: 'اسم الأجيرة — Nom, en arabe'")
   && src.includes("label: 'العنوان — Domicile, en arabe'")
   && src.includes("label: 'حرر بـ — Fait à, en arabe'"))
ok('ils ne sont pas repris du formulaire, qui les écrit en latin',
   detail0.includes("const COUVERTS = enArabe"))
ok('… et le lieu de signature du formulaire ne les écrase pas',
   detail0.includes("...(enArabe ? {} : { fait_a: f.signe_a })"))

console.log('\n  ── Le formulaire du contrat ───────────────────────────')
ok('le formulaire annonce ce qu’il fait',
   detail0.includes('Ce que le contrat imprime'))

console.log('\n  ── Les modèles générés maison ont disparu ─────────────')
for (const f of ['src/components/ContratPrint.tsx', 'src/components/EngagementPrint.tsx',
                 'src/lib/modeles.ts', 'src/components/DocumentCadre.tsx']) {
  ok(`${f} supprimé`, !fs.existsSync(new URL('../../' + f, import.meta.url)))
}

console.log('\n  ── Identité légale des sociétés ───────────────────────')
const soc = fs.readFileSync(new URL('../../src/lib/societes.ts', import.meta.url), 'utf8')
for (const s2 of SOCIETES) ok(`${s2} a un siège`, soc.includes(`'${s2}'`) || s2 === 'BO')
ok('les sièges arabes existent pour les sociétés qui éditent en arabe',
   soc.includes('siegeAr'))

console.log('\n  ── La page se compose pendant la saisie ───────────────')
const detail = fs.readFileSync(new URL('../../src/pages/validator/EmployeDetail.tsx', import.meta.url), 'utf8')
ok('le contrat se rédige avec sa page à côté', detail.includes('<PanneauDocument'))
ok('le congé aussi', (detail.match(/<PanneauDocument/g) ?? []).length >= 2)
ok('les dates du congé alimentent l’engagement',
   detail.includes('debut: dateDoc(f.debut)') && detail.includes('fin: dateDoc(f.fin)'))
ok('la durée du congé se déduit des dates', detail.includes('${jours} يوما'))
ok('les mentions saisies partent avec le congé', detail.includes('champsDocument: docLibre'))
ok('… et avec le contrat', detail.includes('champs_document: docLibre'))
ok('les valeurs connues d’avance remplissent aussi le formulaire',
   detail.includes('modeleEngagement(entreprise).defauts'))

const panneau = fs.readFileSync(new URL('../../src/components/PanneauDocument.tsx', import.meta.url), 'utf8')
ok('la page est mise à l’échelle sans être déformée', panneau.includes('transform: `scale('))
ok('… et ne laisse pas de vide sous elle', panneau.includes('height: hauteur'))
ok('la page peut se lire à sa taille d’impression', panneau.includes('tailleReelle'))
ok('le formulaire garde une largeur fixe, le reste va au document',
   panneau.includes('lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]'))
ok('la fenêtre s’élargit quand le document est à côté',
   fs.readFileSync(new URL('../../src/pages/validator/EmployesPage.tsx', import.meta.url), 'utf8')
     .includes("max-w-[104rem]"))

console.log('\n  ── Les formulaires ne demandent que le nécessaire ─────')
for (const parti of [
  "periode_essai_jours: f.periode_essai_jours", 'lieu_travail: f.lieu_travail.trim()',
  'heures_par_jour: f.heures_par_jour.trim()', 'mode_reglement: f.mode_reglement ||',
  'representant_employeur: f.representant_employeur.trim()',
  'observations: f.observations.trim()',
]) ok(`le contrat ne demande plus « ${parti.split(':')[0]} »`, !detail0.includes(parti))
ok('le contrat n’affiche un champ que si le modèle l’imprime',
   detail0.includes("surLePapier('salaire') && field") && detail0.includes("surLePapier('fait_a') && field"))
ok('le type de contrat reste : il porte les alertes de fin',
   detail0.includes("c’est lui qui distingue un CDI"))
ok('le congé ne demande plus ni type ni motif',
   !detail0.includes("{field('Type', (") && !detail0.includes("{field('Motif', ("))
ok('… et il enregistre bien un congé payé', detail0.includes("type: 'C', motif: ''"))

console.log('\n  ── Reçu pour solde de tout compte ─────────────────────')
const solde = fs.readFileSync(new URL('../../src/lib/soldeToutCompte.ts', import.meta.url), 'utf8')
for (const [quoi, phrase] of [
  ['le titre', 'RECU POUR SOLDE DE TOUT COMPTE'],
  ['la reconnaissance de réception', 'Reconnais avoir reçu de la société'],
  ['le certificat de travail', 'Mon certificat de travail'],
  ['l’article 75 et les 60 jours', 'article 75 du Code du travail'],
  ['les deux exemplaires', 'établi en deux exemplaires'],
  ['la patente et le R.C.', 'N° Patente : {{patente}}     RC : {{rc}}'],
]) ok(quoi + ' est repris', solde.includes(phrase))
ok('l’identité de la société est préremplie', solde.includes('patente: s?.patente'))

const sortiesPage = fs.readFileSync(new URL('../../src/pages/validator/SortiesPage.tsx', import.meta.url), 'utf8')
ok('on choisit l’employé, et sa fiche remplit le reçu',
   sortiesPage.includes('— Choisir un employé —') && sortiesPage.includes('valeursEmploye'))
ok('le reçu se compose pendant la saisie', sortiesPage.includes('<PanneauDocument'))
ok('la validation demande une confirmation', sortiesPage.includes('Confirmer : il quitte les listes'))
ok('le départ se fait en deux temps : valider, puis clôturer le mois',
   sortiesPage.includes('function ClotureDuMois'))
ok('seul l’administrateur voit la clôture',
   sortiesPage.includes("profile?.role === 'admin' && <ClotureDuMois"))
ok('une fiche archivée quitte la liste des employés',
   fs.readFileSync(new URL('../../src/pages/validator/EmployesPage.tsx', import.meta.url), 'utf8')
     .includes(".is('archive_le', null)"))
ok('les sorties sont réservées au bureau et à l’administrateur',
   fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')
     .includes("<RequireRole roles={['validator', 'admin']}>"))
ok('l’icône des sorties a la taille des autres',
   fs.readFileSync(new URL('../../src/components/Layout.tsx', import.meta.url), 'utf8')
     .match(/sorties: \(\s*<svg[^>]*className="h-5 w-5"/))
ok('… et dit ce qu’elle emporte et ce qu’elle garde',
   sortiesPage.includes('restent consultables'))

console.log('\n' + '═'.repeat(66))
console.log(F === 0 ? `  ✅  ${P} vérifications, toutes réussies` : `  ❌  ${F} échec(s) sur ${P + F}`)
console.log('═'.repeat(66))
process.exit(F ? 1 : 0)
