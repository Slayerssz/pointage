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

console.log('\n' + '═'.repeat(66))
console.log(F === 0 ? `  ✅  ${P} vérifications, toutes réussies` : `  ❌  ${F} échec(s) sur ${P + F}`)
console.log('═'.repeat(66))
process.exit(F ? 1 : 0)
