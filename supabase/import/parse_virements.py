"""Lit les états de virement : à qui, dans quelle banque, sur quel compte.

Le numéro de la première colonne est un rang dans la liste, pas le
matricule : le rapprochement se fera sur le nom.

On lit la ligne PAR LA DROITE — le compte, puis la banque, et tout ce qui
reste est le nom. Découper sur les blancs multiples coupait les noms qui
en contiennent eux-mêmes (« EC-CHEKH   ZAHRA »), et la banque partait
alors avec le prénom.
"""
import glob, json, os, re, sys

SP = sys.argv[1]

# Les banques telles qu'elles s'écrivent sur ces états.
BANQUES = [
    'ATTIJARIWAFA BANK', 'BANQUE POPULAIRE', 'AL BARID BANK', 'AL BARID CASH',
    'BARID CASH', 'CREDIT AGRICOLE', 'CREDIT DU MAROC', 'SOCIETE GENERALE',
    'TRESORERIE GENERALE', 'CIH BANK', 'CIH BANQUE', 'BMCE BANK', 'BMCI BANK',
    'BMCI', 'SAHAM BANK', 'CASH PLUS', 'DAMANE CASH', 'WAFACASH', 'WAFACACH',
    'CFG BANK', 'BANK OF AFRICA', 'UMNIA BANK', 'CDM', 'SGMB', 'ARAB BANK',
]
BANQUES.sort(key=len, reverse=True)   # les plus longues d'abord

# Une même banque s'écrit de plusieurs façons d'un état à l'autre. On
# retient une seule forme, sans quoi le récapitulatif par banque
# éparpillerait les virements entre « CIH BANK » et « CIH BANQUE ».
# AL BARID BANK et AL BARID CASH restent distinctes : ce sont deux
# produits différents.
NORMALISE = {
    'CIH BANQUE': 'CIH BANK',
    'BMCI BANK': 'BMCI',
    'WAFACACH': 'WAFACASH',
    'BARID CASH': 'AL BARID CASH',
}

DEBUT = re.compile(r'^\s*(\d+)\s+(\S.*)$')
COMPTE = re.compile(r'(\d[\d\s]{20,})\s*$')

def lire(ligne):
    d = DEBUT.match(ligne.rstrip())
    if not d:
        return None
    rang, reste = d.groups()

    c = COMPTE.search(reste)
    if not c:
        return None
    rib = re.sub(r'\s+', '', c.group(1))
    if len(rib) != 24:
        return None
    avant = reste[:c.start()].strip()

    for b in BANQUES:
        if avant.upper().endswith(b):
            nom = avant[:len(avant) - len(b)].strip()
            return {'rang': int(rang), 'nom_prenom': ' '.join(nom.split()),
                    'banque': NORMALISE.get(b, b), 'rib': rib}
    # Banque inconnue : on la signale plutôt que de la deviner.
    return {'rang': int(rang), 'nom_prenom': ' '.join(avant.split()),
            'banque': None, 'rib': rib, 'brut': avant}

tout, inconnues = {}, []
for f in sorted(glob.glob(os.path.join(SP, 'virements', '*.txt'))):
    nom = os.path.basename(f).replace('.txt', '')
    gens = [g for g in (lire(l) for l in open(f)) if g]
    for g in gens:
        if g['banque'] is None:
            inconnues.append((nom, g['brut']))
    tout[nom] = gens
    print(f'{nom:32} {len(gens):4} virements')

if inconnues:
    print('\n⚠ Banques non reconnues :')
    for soc, brut in inconnues:
        print(f'   {soc:30} {brut}')

json.dump(tout, open(os.path.join(SP, 'virements', 'virements.json'), 'w'),
          ensure_ascii=False, indent=1)

from collections import Counter
banques = Counter(g['banque'] for v in tout.values() for g in v)
print('\nRépartition par banque :')
for b, n in banques.most_common():
    print(f'   {str(b):22} {n:4}')
print('\ntotal :', sum(len(v) for v in tout.values()))
