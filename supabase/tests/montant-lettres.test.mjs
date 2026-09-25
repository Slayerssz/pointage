/**
 * Le montant en toutes lettres : c'est la mention qui fait foi sur un
 * ordre de virement. Les pièges sont les accords de « vingt » et
 * « cent », l'invariabilité de « mille », et les « et un ».
 */
import fs from 'node:fs'
import { transformWithOxc } from 'vite'

const src = fs.readFileSync('src/lib/montantEnLettres.ts', 'utf8')
const { code } = await transformWithOxc(src, 'm.ts', { lang: 'ts' })
const { montantEnLettres } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

let P = 0, F = 0
const ok = (montant, attendu) => {
  const obtenu = montantEnLettres(montant)
  if (obtenu === attendu) { P++; console.log(`    ✓ ${montant} → ${obtenu}`) }
  else { F++; console.log(`    ✗ ${montant}\n        attendu : ${attendu}\n        obtenu  : ${obtenu}`) }
}

console.log('\n  ── Le montant en toutes lettres ──────────────────────────────')
ok(0, 'zéro dirham')
ok(1, 'un dirham')
ok(2, 'deux dirhams')
ok(16, 'seize dirhams')
ok(21, 'vingt et un dirhams')
ok(31, 'trente et un dirhams')
ok(71, 'soixante et onze dirhams')
ok(72, 'soixante-douze dirhams')
ok(80, 'quatre-vingts dirhams')
ok(81, 'quatre-vingt-un dirhams')
ok(91, 'quatre-vingt-onze dirhams')
ok(99, 'quatre-vingt-dix-neuf dirhams')
ok(100, 'cent dirhams')
ok(101, 'cent un dirhams')
ok(200, 'deux cents dirhams')
ok(201, 'deux cent un dirhams')
ok(280, 'deux cent quatre-vingts dirhams')
ok(1000, 'mille dirhams')
ok(1001, 'mille un dirhams')
ok(2000, 'deux mille dirhams')
ok(80000, 'quatre-vingt mille dirhams')
ok(100000, 'cent mille dirhams')
ok(200000, 'deux cent mille dirhams')
ok(1000000, 'un million dirhams')
ok(2000000, 'deux millions dirhams')
// Devant « millions », qui est un nom, « cents » garde son s
ok(200000000, 'deux cents millions dirhams')
ok(80000000, 'quatre-vingts millions dirhams')
// Les cas du terrain
ok(3046, 'trois mille quarante-six dirhams')
ok(48542.5, 'quarante-huit mille cinq cent quarante-deux dirhams et cinquante centimes')
ok(1350.45, 'mille trois cent cinquante dirhams et quarante-cinq centimes')
ok(613.83, 'six cent treize dirhams et quatre-vingt-trois centimes')
ok(2.01, 'deux dirhams et un centime')
ok(0.5, 'zéro dirham et cinquante centimes')
// L'arrondi ne doit pas inventer de centimes
ok(1000.004, 'mille dirhams')
ok(9.999, 'dix dirhams')

console.log('\n' + '═'.repeat(68))
console.log(F === 0 ? `  ✅  ${P} vérifications, toutes réussies`
                    : `  ❌  ${F} échec(s) sur ${P + F}`)
console.log('═'.repeat(68))
process.exit(F ? 1 : 0)
