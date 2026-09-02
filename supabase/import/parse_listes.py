"""Lit les états « Total Salariers » et en tire un registre exploitable.

Le découpage ne se fie pas à la position des colonnes : d'une page à
l'autre elles glissent de un ou deux caractères. On reconnaît plutôt
chaque champ à sa forme — un C.I.N. est une ou trois lettres suivies de
chiffres, un numéro C.N.S.S. fait neuf chiffres, une date s'écrit
jj/mm/aaaa — et on se sert des blancs multiples, que la mise en page
conserve, pour séparer qualification, adresse et ville.

Les regroupements se lisent à la structure : deux lignes de titre à la
suite = département puis site ; une ligne isolée = un nouveau site dans
le même département.
"""
import glob, json, os, re, sys
import pypdf

DL = os.path.expanduser('~/Downloads')

DATE   = re.compile(r'\b(\d{2}/\d{2}/\d{4})\b')
CIN    = re.compile(r'\b([A-Z]{1,3}\d{3,8})\b')
CNSS   = re.compile(r'\b(\d{9})\b')
REGLEMENT = re.compile(r'\b(Virement|Espece|Versement)\s*$')
DEBUT  = re.compile(r'^\s{2,}(\d+)\s+(\S.*)$')
IGNORER = re.compile(r'Total Salariers|Total de Salariers|^\s*\d+/\d+\s*$|^\s*$|Nom Prenom')


def decouper(reste):
    """Extrait les champs d'une ligne d'employé, matricule déjà retiré."""
    e = {}

    m = REGLEMENT.search(reste)
    e['mode_reglement'] = m.group(1) if m else ''
    corps = reste[:m.start()] if m else reste

    dates = list(DATE.finditer(corps))
    # naissance, embauche, et éventuellement sortie — dans cet ordre
    for cle, d in zip(('date_naissance', 'date_embauche', 'date_sortie'), dates):
        j, mo, a = d.group(1).split('/')
        e[cle] = f'{a}-{mo}-{j}'
    e.setdefault('date_naissance', None)
    e.setdefault('date_embauche', None)
    e.setdefault('date_sortie', None)

    avant = corps[:dates[0].start()] if dates else corps
    apres = corps[dates[-1].end():] if dates else ''

    # Avant les dates : le nom, puis le C.I.N., puis le n° C.N.S.S.
    c = CIN.search(avant)
    e['cin'] = c.group(1) if c else ''
    e['nom_prenom'] = ' '.join((avant[:c.start()] if c else avant).split())
    n = CNSS.search(avant[c.end():] if c else avant)
    e['cnss'] = n.group(1) if n else ''

    # Après les dates : qualification, adresse, ville — séparées par des blancs
    morceaux = [x.strip() for x in re.split(r'\s{2,}', apres.strip()) if x.strip()]
    e['qualification'] = morceaux[0] if len(morceaux) > 0 else ''
    e['adresse']       = morceaux[1] if len(morceaux) > 1 else ''
    e['ville']         = morceaux[2] if len(morceaux) > 2 else ''
    return e


def lire(fichier):
    r = pypdf.PdfReader(fichier)
    lignes = []
    for p in r.pages:
        lignes += (p.extract_text(extraction_mode="layout") or '').split('\n')

    employes, departement, site, titres = [], None, None, []

    def vider_titres():
        nonlocal departement, site
        if len(titres) >= 2:
            departement, site = titres[-2], titres[-1]
        elif len(titres) == 1:
            site = titres[0]
        titres.clear()

    for l in lignes:
        if IGNORER.search(l):
            continue
        m = DEBUT.match(l)
        if m and DATE.search(l):
            vider_titres()
            e = decouper(m.group(2))
            e['matricule'] = int(m.group(1))
            e['departement'] = departement
            e['site'] = site
            employes.append(e)
        else:
            titres.append(l.strip())
    return employes


tout = {}
for f in sorted(glob.glob(os.path.join(DL, 'Etat_Total_Salarier *.pdf'))):
    nom = os.path.basename(f).replace('Etat_Total_Salarier ', '').replace('.pdf', '')
    emps = lire(f)
    tout[nom] = emps
    print(f'{nom:34} {len(emps):4} employés · {len({e["site"] for e in emps}):2} sites'
          f' · {len({e["departement"] for e in emps}):2} départements')

json.dump(tout, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('\ntotal :', sum(len(v) for v in tout.values()), 'employés')
