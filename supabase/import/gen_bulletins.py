"""Fabrique la planche d'aperçu : un bulletin par société, à son en-tête."""
import base64, json, os, sys

RACINE, DST = sys.argv[1], sys.argv[2]

# nom en base, fichier logo, accent, et un salarié fictif représentatif
SOCIETES = [
 ('GROUPE TRIPLE A',        'groupe-triple-a',        '#94040d', 'SECURITE',
  'EL AMRANI MOHAMED',   1042, 'AB123456', '1234567',  6500, 26, 'CIH BANK',
  'AGENCE URBAINE TANGER', 'Agent de sécurité'),
 ('EDEN VERT SERVICE',      'eden-vert-service',      '#366d81', 'NETTOYAGE',
  'BENNANI KHADIJA',      318, 'K402118', '145276682', 3500, 26, 'ATTIJARIWAFA',
  'HOTEL DE VILLE', 'Agent de nettoyage'),
 ('AL SAFAE EL MAGHREB',    'al-safae-el-maghreb',    '#0f2155', 'JARDINAGE',
  'OUAZZANI YOUSSEF',      77, 'LC190244', '108965708', 3200, 24, 'BANQUE POPULAIRE',
  'OFPPT', 'Jardinier'),
 ('BO',                     'bo',                     '#0c6aa4', 'NETTOYAGE',
  'TRIBAK RAHMA',        1092, 'K188284', '162437085',  4200, 26, 'BMCE BANK',
  'ONDA AL HOCEIMA', 'Agent de nettoyage'),
 ('TRIMAX',                 'trimax',                 '#171b32', 'GARDIENNAGE',
  'ECHCHARKI SAID',         7, 'C408695', '134611547',  3800, 25, 'CIH BANK',
  'BLOC SANITAIRE', 'Gardien'),
 ('VIGILMA GARD MAROC',     'vigilma-gard-maroc',     '#63656a', 'SECURITE',
  'EL JBARI ABDENOUR',    221, 'LC58156', '180883088',  7200, 26, 'ATTIJARIWAFA',
  'MARCHE GROS NOUVEAUX', 'Agent de sécurité'),
 ('NORD PLANET',            'nord-planet',            '#006f9d', 'NETTOYAGE',
  'BOU AJAJ SOUKAINA',    103, 'K574061', '142720916',  3300, 26, 'CIH BANK',
  'CRI-Tanger', 'Agent de nettoyage'),
 ('SERCLEAN NEGOCE',        'serclean-negoce',        '#2c2667', 'ACCUEIL',
  'AIT BEN HADDOU HANANE',  28, 'U200632', '155405370', 3600, 26, 'BANQUE POPULAIRE',
  'AL OMRANE Draa-Tafilalet', "Agent d'accueil"),
 ('DUO MULTI SERVICE',      'duo-multi-service',      '#a8070c', 'NETTOYAGE',
  'ZAHRAOUI FATIMA',       12, 'LA73095', '170057263',  3400, 23, 'BMCE BANK',
  'SIÈGE', 'Agent de nettoyage'),
 ('MEGANTER SERVICE MAROC', 'meganter-service-maroc', '#616364', 'SECURITE',
  'BENALI MOHAMED',        99, 'R337007', '183552698',  5900, 26, 'CIH BANK',
  'SIÈGE', 'Agent de sécurité'),
]

TAUX_CNSS, TAUX_AMO, JOURS_BASE, HEURES = 4.48, 2.26, 26, 191

def n2(v):
    return f'{v:,.2f}'.replace(',', ' ').replace('.', ',')

def logo(f):
    p = os.path.join(RACINE, 'public', 'entetes', f + '.png')
    return base64.b64encode(open(p, 'rb').read()).decode()

cartes, sommaire = [], []
for (nom, fich, accent, dep, personne, mat, cin, cnss, salaire, jours,
     banque, site, poste) in SOCIETES:
    brut  = round(salaire * jours / JOURS_BASE, 2)
    c     = round(brut * TAUX_CNSS / 100, 2)
    amo   = round(brut * TAUX_AMO  / 100, 2)
    net   = round(brut - c - amo, 2)
    ancre = fich

    sommaire.append(f'<a href="#{ancre}"><span class="pastille" style="background:{accent}"></span>{nom}</a>')

    lignes = [
      ('001', 'SALAIRE BRUT',        n2(salaire), f'{n2(jours)} j',        n2(brut), ''),
      ('068', 'COTISATION C.N.S.S.', n2(brut),    f'{n2(TAUX_CNSS)} %',    '',       n2(c)),
      ('069', 'ASSURANCE A.M.O.',    n2(brut),    f'{n2(TAUX_AMO)} %',     '',       n2(amo)),
      ('070', 'I.G.R.',              n2(brut-c-amo), '',                   '',       '0,00'),
    ]
    corps = '\n'.join(
      f'<tr><td>{a}</td><td>{b}</td><td class="n">{d}</td><td class="n">{e}</td>'
      f'<td class="n">{f}</td><td class="n">{g}</td></tr>'
      for a, b, d, e, f, g in lignes)

    igr_note = ('' if brut < 6000 else
      '<p class="avis">Barème I.G.R. non renseigné : la retenue affichée est provisoire.</p>')

    cartes.append(f'''
<section class="bloc" id="{ancre}">
  <h2 class="nom-societe"><span class="pastille" style="background:{accent}"></span>{nom}</h2>
  <div class="feuille-scroll"><article class="feuille" style="--accent:{accent}">
    <div class="tete">
      <img src="data:image/png;base64,{logo(fich)}" alt="{nom}">
      <div class="titre-doc">
        <strong>Bulletin de paie</strong><span>Juillet 2026</span>
      </div>
    </div>

    <table class="ident"><tbody>
      <tr><td class="k">Matricule</td><td>{mat}</td>
          <td class="k">Nom &amp; Prénom</td><td>{personne}</td>
          <td class="k">Qualification</td><td>{poste}</td></tr>
      <tr><td class="k">C.I.N.</td><td>{cin}</td>
          <td class="k">N° C.N.S.S.</td><td>{cnss}</td>
          <td class="k">Date d’embauche</td><td>01/10/2024</td></tr>
      <tr><td class="k">Situation</td><td>Marié(e)</td>
          <td class="k">Enfants</td><td>2</td>
          <td class="k">Lieu de travail</td><td>{site}</td></tr>
      <tr><td class="k">Mode de règlement</td><td>Virement</td>
          <td class="k">Banque</td><td colspan="3">{banque}</td></tr>
      <tr><td class="k">R.I.B.</td><td colspan="5">230 810 1234567890123456 78</td></tr>
    </tbody></table>

    <table class="corps">
      <thead><tr><th>Code</th><th>Libelle</th><th>Base</th><th>Taux</th>
                 <th>Gain</th><th>Retenue</th></tr></thead>
      <tbody>
        {corps}
        <tr class="net"><td></td><td>GAIN NET</td><td></td><td></td>
            <td class="n">{n2(net)}</td><td></td></tr>
        <tr class="totaux"><td></td><td>TOTAUX</td><td></td><td></td>
            <td class="n">{n2(brut)}</td><td class="n">{n2(c+amo)}</td></tr>
      </tbody>
    </table>
    {igr_note}

    <table class="pied">
      <thead><tr><th>J. Trav.</th><th>Cumul I.G.R.</th><th>Cum. C.N.S.S.</th>
                 <th>Hr. Sal.</th><th>Net à Payer</th></tr></thead>
      <tbody><tr><td>{n2(jours)}</td><td>0,00</td><td>{n2(c)}</td>
                 <td>{HEURES},0</td><td class="gros">{n2(net)} DH</td></tr></tbody>
    </table>

    <div class="signatures">
      <div><p>Signature de l’employé</p><div class="trait"></div></div>
      <div class="droite"><p>Pour {nom}</p><div class="trait"></div></div>
    </div>
    <p class="mention">Net calculé sur {n2(jours)} jours travaillés ·
       Édité le 02/09/2026 · Gain net {n2(net)} DH</p>
  </article></div>
</section>''')

html = f'''<title>Bulletins de paie — les dix sociétés</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap">
<style>
:root {{
  --ground:#f7f5f3; --card:#ffffff; --ink:#1b1917; --muted:#78706b;
  --rule:#e4dedb; --accent-page:#8a5a3b;
  --shadow:0 1px 2px rgba(60,40,25,.07), 0 10px 28px -8px rgba(60,40,25,.14);
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --ground:#151313; --card:#1e1b1a; --ink:#efe9e6; --muted:#a0968f;
    --rule:#2e2825; --accent-page:#d09a72;
    --shadow:0 1px 2px rgba(0,0,0,.5), 0 14px 36px -10px rgba(0,0,0,.6);
  }}
}}
:root[data-theme="dark"] {{
  --ground:#151313; --card:#1e1b1a; --ink:#efe9e6; --muted:#a0968f;
  --rule:#2e2825; --accent-page:#d09a72;
  --shadow:0 1px 2px rgba(0,0,0,.5), 0 14px 36px -10px rgba(0,0,0,.6);
}}
body {{
  background:var(--ground); color:var(--ink); margin:0;
  font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif; line-height:1.55;
  padding:clamp(1.5rem,4vw,3rem) 1.25rem 4rem;
}}
.wrap {{ max-width:52rem; margin:0 auto; display:flex; flex-direction:column; gap:2rem; }}
.eyebrow {{ margin:0 0 .5rem; font-size:.72rem; font-weight:600; letter-spacing:.1em;
           text-transform:uppercase; color:var(--accent-page); }}
h1 {{ font-family:Newsreader,Georgia,serif; font-weight:500; margin:0 0 .5rem;
     font-size:clamp(1.8rem,4.5vw,2.5rem); line-height:1.15; text-wrap:balance; }}
header p {{ margin:0; color:var(--muted); max-width:36rem; }}
.stamp {{ display:inline-block; margin-top:1rem; border:1px solid var(--rule);
         border-radius:999px; padding:.3rem .85rem; font-size:.78rem; color:var(--muted); }}

nav {{ display:flex; flex-wrap:wrap; gap:.4rem; }}
nav a {{ display:flex; align-items:center; gap:.45rem; text-decoration:none;
        border:1px solid var(--rule); border-radius:999px; padding:.3rem .7rem;
        font-size:.8rem; color:var(--ink); background:var(--card); }}
nav a:hover, nav a:focus-visible {{ border-color:var(--accent-page); }}
.pastille {{ width:.6rem; height:.6rem; border-radius:50%; display:inline-block; flex:none; }}

.bloc {{ scroll-margin-top:1rem; }}
.nom-societe {{ display:flex; align-items:center; gap:.5rem; margin:0 0 .6rem;
               font-family:Newsreader,Georgia,serif; font-weight:500; font-size:1.25rem; }}

.feuille-scroll {{ overflow-x:auto; }}
.feuille {{ background:#fff; color:#111; box-shadow:var(--shadow); font-size:11px;
           line-height:1.4; width:690px; min-width:690px; padding:34px 42px 40px;
           font-variant-numeric:tabular-nums; }}
.tete {{ display:flex; justify-content:space-between; align-items:flex-start; gap:1.5rem;
        padding-bottom:9px; border-bottom:2px solid var(--accent); }}
.tete img {{ height:64px; }}
.titre-doc {{ text-align:right; }}
.titre-doc strong {{ display:block; color:var(--accent); font-size:15px; font-weight:700;
                    letter-spacing:.04em; text-transform:uppercase; }}
.titre-doc span {{ display:block; font-size:12px; font-weight:600;
                  text-transform:uppercase; margin-top:2px; }}
table {{ border-collapse:collapse; width:100%; }}
.ident {{ margin-top:15px; border:1px solid #444; }}
.ident td {{ border:1px solid #444; padding:4px 6px; }}
.ident .k {{ font-size:9px; font-weight:600; text-transform:uppercase; color:var(--accent);
            background:#fafafa; white-space:nowrap; }}
.corps {{ margin-top:15px; border:1px solid #444; }}
.corps th {{ background:var(--accent); color:#fff; border:1px solid #444; padding:4px 6px;
            font-size:9.5px; font-weight:700; letter-spacing:.03em;
            text-transform:uppercase; text-align:right; }}
.corps th:first-child, .corps th:nth-child(2) {{ text-align:left; }}
.corps td {{ border:1px solid #444; padding:4px 6px; }}
.corps td.n {{ text-align:right; }}
.corps tr.net {{ font-weight:700; background:#eee; }}
.corps tr.totaux td {{ font-size:9.5px; }}
.avis {{ margin:8px 0 0; border:1px solid #444; background:#f2f2f2; padding:4px 8px;
        font-size:9.5px; font-weight:600; }}
.pied {{ margin-top:15px; border:1px solid #444; }}
.pied th {{ background:#eee; border:1px solid #444; padding:4px 6px; font-size:9.5px;
           font-weight:700; text-transform:uppercase; text-align:center; }}
.pied td {{ border:1px solid #444; padding:6px; text-align:center; font-size:12px; }}
.pied td.gros {{ font-size:14px; font-weight:700; }}
.signatures {{ display:flex; justify-content:space-between; margin-top:40px; font-size:11px; }}
.signatures div {{ width:220px; }}
.signatures p {{ margin:0 0 32px; }}
.signatures .trait {{ border-top:1px solid #444; }}
.signatures .droite {{ text-align:right; }}
.mention {{ margin:16px 0 0; text-align:center; font-size:9px; color:#666; }}

.notes {{ display:flex; flex-direction:column; gap:.9rem; }}
.note {{ border-left:2px solid var(--accent-page); padding-left:.9rem; }}
.note strong {{ display:block; font-size:.93rem; }}
.note span {{ color:var(--muted); font-size:.89rem; }}
h2.section {{ font-family:Newsreader,Georgia,serif; font-weight:500; font-size:1.4rem;
             margin:0 0 .25rem; }}
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Groupe Triple A · module Paie</p>
    <h1>Bulletins de paie</h1>
    <p>Le même document pour les dix sociétés, chacune à son en-tête et à sa
       couleur. Édité uniquement pour les employés payés par virement — les
       seuls déclarés à la C.N.S.S. Une page A4 par personne.</p>
    <p class="stamp">Aperçu · salariés fictifs, chiffres d’exemple</p>
  </header>

  <nav>{''.join(sommaire)}</nav>

  {''.join(cartes)}

  <section>
    <h2 class="section">Ce qu’il reste à régler</h2>
    <div class="notes">
      <div class="note"><strong>Le barème I.G.R. est vide</strong>
        <span>Aucun taux n’a été inventé. Tant qu’aucune tranche n’est saisie,
        l’I.G.R. vaut 0 et le bulletin l’écrit noir sur blanc, comme sur les
        exemples au-dessus de 6 000 DH. À remplir dans Entreprises → Barème
        de l’I.G.R.</span></div>
      <div class="note"><strong>C.N.S.S. à 4,48 % du brut, A.M.O. à 2,26 %</strong>
        <span>Sans plafond, conformément à la consigne. Le paramètre de plafond
        existe et reste vide ; il se renseigne sans nouvelle migration si le
        comptable le demande.</span></div>
      <div class="note"><strong>191 heures salariales</strong>
        <span>Le samedi ne comptant qu’une demi-journée, 26 jours travaillés
        donnent 191 heures et non 208. Paramétrable par société.</span></div>
      <div class="note"><strong>Le prorata sur les jours réellement travaillés</strong>
        <span>Al Safae, Trimax et Duo montrent 24, 25 et 23 jours : le brut
        descend d’autant, et cotisations et net suivent.</span></div>
    </div>
  </section>
</div>
'''
open(DST, 'w').write(html)
print('octets :', len(html))
