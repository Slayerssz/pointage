/**
 * LES CONTRATS DE TRAVAIL, UN MODÈLE PAR SOCIÉTÉ.
 *
 * Le texte est repris mot pour mot des contrats fournis : ce sont des
 * pièces juridiques, on ne les reformule pas. Les pointillés du papier
 * deviennent des jetons {{champ}} ; tout le reste est figé.
 *
 * Ces documents s'impriment SANS en-tête ni logo : ils partent chez le
 * notaire pour légalisation, et c'est la signature qui les authentifie.
 */

export type TypeChamp = 'texte' | 'date' | 'nombre' | 'long'

export interface ChampContrat {
  id: string
  label: string
  type: TypeChamp
  /** Ce que le champ vaut au départ, quand on peut le déduire du dossier. */
  depuis?: 'nom_prenom' | 'cin' | 'date_naissance' | 'adresse' | 'salaire' | 'ville' | 'mode_reglement'
  aide?: string
}

export type Bloc =
  | { type: 'titre'; texte: string }
  | { type: 'para'; texte: string }
  | { type: 'section'; texte: string }
  | { type: 'puces'; items: string[] }
  | { type: 'espace' }

export interface ModeleContrat {
  /** Le titre en tête du document. */
  titre: string
  langue: 'fr' | 'ar'
  champs: ChampContrat[]
  blocs: Bloc[]
  /** Des valeurs connues d'avance, indépendantes de l'employé. */
  defauts?: Record<string, string>
  /** Ce qui figure sous les deux signatures, s'il y a lieu. */
  mentionSignature?: string
  gauche: string
  droite: string
}

// ─────────────────────────────────────────────────────────────────────────
//  Les champs que l'on retrouve d'un modèle à l'autre
// ─────────────────────────────────────────────────────────────────────────

const NOM: ChampContrat = { id: 'nom', label: 'Nom et prénom', type: 'texte', depuis: 'nom_prenom' }
const CIN: ChampContrat = { id: 'cin', label: 'N° C.I.N.', type: 'texte', depuis: 'cin' }
const NAISSANCE: ChampContrat = { id: 'naissance', label: 'Date de naissance', type: 'date', depuis: 'date_naissance' }
const ADRESSE: ChampContrat = { id: 'adresse', label: 'Domicile', type: 'long', depuis: 'adresse' }
const DEBUT: ChampContrat = { id: 'debut', label: 'Date de début', type: 'date' }
const FIN: ChampContrat = { id: 'fin', label: 'Date de fin', type: 'date' }
const SALAIRE: ChampContrat = { id: 'salaire', label: 'Rémunération brute', type: 'texte', depuis: 'salaire' }
const MARCHE: ChampContrat = { id: 'marche', label: 'Marché n°', type: 'texte' }
const FAIT_A: ChampContrat = { id: 'fait_a', label: 'Fait à', type: 'texte', depuis: 'ville' }
const FAIT_LE: ChampContrat = { id: 'fait_le', label: 'Le', type: 'date' }

// ─────────────────────────────────────────────────────────────────────────
//  FAMILLE A — « contrat de travail temporaire / à durée déterminée »
//  BO, Duo, Groupe Triple A, Megainter, Nord Planet
// ─────────────────────────────────────────────────────────────────────────

interface OptionsA {
  titre: string
  societe: string
  representant: string
  civilite: string
  /** La phrase de prise d'effet, qui diffère d'une société à l'autre. */
  effet: string
  /** Un marché est-il cité dans la prise d'effet ? */
  avecMarche?: boolean
  duree: string
  remuneration: string
  fonction: string
  /** Duo imprime « Fait à Tanger » en dur. */
  faitA?: string
}

function familleA(o: OptionsA): ModeleContrat {
  const champs: ChampContrat[] = [NOM, CIN, NAISSANCE, ADRESSE]
  if (o.avecMarche) champs.push(MARCHE)
  champs.push(DEBUT, FIN, SALAIRE)
  if (o.fonction.includes('{{fonction}}')) {
    champs.push({ id: 'fonction', label: 'Fonction', type: 'texte' })
  }
  if (!o.faitA) champs.push(FAIT_A)
  champs.push(FAIT_LE)

  return {
    titre: o.titre,
    langue: 'fr',
    champs,
    gauche: 'L’employeur',
    droite: 'L’employé',
    mentionSignature: 'PS : Signature légalisée',
    blocs: [
      { type: 'para', texte: 'Entre les soussignés,' },
      { type: 'espace' },
      { type: 'para', texte: o.societe },
      { type: 'para', texte: o.representant },
      { type: 'para', texte: 'Ci-dessous dénommée, l’employeur.' },
      { type: 'espace' },
      { type: 'para', texte: 'Et' },
      { type: 'espace' },
      {
        type: 'para',
        texte: `${o.civilite} {{nom}}, C.I.N n° {{cin}} Né(e) Le {{naissance}}, domicilié à : {{adresse}}`,
      },
      { type: 'para', texte: 'Ci-dessous dénommée, l’employé.' },
      { type: 'espace' },
      { type: 'para', texte: 'Il a été convenu ce qui suit,' },
      { type: 'espace' },
      { type: 'section', texte: 'I. Date d’effet :' },
      { type: 'para', texte: o.effet },
      { type: 'espace' },
      { type: 'section', texte: 'II. Exercice de l’activité :' },
      {
        type: 'para',
        texte:
          'Le salarié accepte l’emploi qui lui est proposé selon les termes et conditions énoncés le présent contrat de travail temporaire et en annexes jointes au présent contrat. Il s’engage à consacrer son temps professionnel à l’exercice de ses fonctions avec :',
      },
      { type: 'puces', items: [o.duree, o.remuneration] },
      {
        type: 'para',
        texte: `Tout au long de la durée du contrat, le salarié remplira les fonctions ${o.fonction}.`,
      },
      { type: 'espace' },
      { type: 'section', texte: 'Conditions particulières' },
      {
        type: 'para',
        texte:
          '1- L’employé, qui accepte cet engagement, avoir quitté son précédent emploi libre de tout engagement, notamment libre de l’engagement de non-concurrence.',
      },
      {
        type: 'para',
        texte:
          '2- Pendant toute la durée du présent Contrat, L’employé s’engage à consacrer tout son temps de travail et tous ses efforts au profit exclusif de l’employeur.',
      },
      {
        type: 'para',
        texte:
          'Il s’interdit donc d’exercer toute autre activité professionnelle ou commerciale ; notamment dans des domaines qui seraient directement ou indirectement en concurrence avec les activités des sociétés qui lui sont affiliés et/ou associées.',
      },
      {
        type: 'para',
        texte:
          '3- l’employé pourra être amené ponctuellement ou temporairement, à se déplacer partout au Maroc ou les nécessités de son travail l’exigeront et notamment en tout autre endroit du Maroc ou à l’étranger.',
      },
      {
        type: 'para',
        texte:
          'Toute violation de cette obligation d’exclusivité pourrait entrainer la résiliation du présent contrat pour faute grave.',
      },
      {
        type: 'para',
        texte:
          '4- l’employé est tenu d’avoir un comportement exemplaire au sein de l’entreprise, (conscience professionnelle, rendement, discipline) et au respect du secret professionnel et de la hiérarchie.',
      },
      {
        type: 'para',
        texte:
          'Il est responsable dans le cadre de son travail conformément à l’article 20 du code du travail de son acte, de sa négligence, d’impéritie ou de son imprudence.',
      },
      {
        type: 'para',
        texte:
          '5- l’employeur se réserve le droit, selon les besoins du service, à la réparation des heures du travail et aux affectations au poste de travail de l’employé.',
      },
      {
        type: 'para',
        texte:
          '6- Ce contrat peut être résilié par simple décision des membres de l’administration et par simple lettre de notification et sans aucunes indemnités pour les raisons suivantes :',
      },
      {
        type: 'puces',
        items: [
          'Fin de l’accroissement temporaire ou total de l’activité de l’employeur.',
          'En cas de faute grave conformément à l’article 39 du code du travail.',
          'En cas de force majeur.',
          'En cas de grossesse dès le 2ème mois.',
        ],
      },
      {
        type: 'para',
        texte:
          'Et le salarié déclare par la présente de prendre son solde de tout compte à l’amiable selon les calculs effectués et établit par la dite administration soit : le droit de congé payé, préavis et Indemnités de débouchement selon le nombre des heures équivalents à chaque année d’ancienneté, et sans aucune réclamation d’autres sommes.',
      },
      { type: 'espace' },
      {
        type: 'para',
        texte: `Fait à ${o.faitA ?? '{{fait_a}}'} le : {{fait_le}}`,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  FAMILLE B — « à durée déterminée liée à un projet » — Trimax, Serclean
// ─────────────────────────────────────────────────────────────────────────

interface OptionsB {
  societe: string
  civilite: string
  denomination: string
  contexte: string
  objet: string
  fonctionChamp?: boolean
}

function familleB(o: OptionsB): ModeleContrat {
  const champs: ChampContrat[] = [NOM, NAISSANCE, CIN, ADRESSE, MARCHE]
  if (o.fonctionChamp) champs.push({ id: 'fonction', label: 'Fonction', type: 'texte' })
  champs.push(
    { id: 'duree', label: 'Durée du contrat', type: 'texte', aide: 'Par exemple : trois ans' },
    DEBUT, FIN,
    { id: 'heures', label: 'Heures par mois', type: 'nombre' },
    FAIT_A, FAIT_LE,
  )

  return {
    titre: 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE LIÉ À UN PROJET',
    langue: 'fr',
    champs,
    gauche: 'L’Employeur',
    droite: 'le Salarié',
    blocs: [
      { type: 'para', texte: 'Entre les soussignés :' },
      { type: 'espace' },
      { type: 'para', texte: o.societe },
      { type: 'para', texte: 'Et :' },
      { type: 'espace' },
      {
        type: 'para',
        texte: `${o.civilite} {{nom}}, né(e) le {{naissance}}, titulaire de la CIN n° {{cin}}, domicilié(e) à {{adresse}}, ci-après dénommé(e) « ${o.denomination} »,`,
      },
      { type: 'espace' },
      { type: 'para', texte: 'Il a été convenu ce qui suit :' },
      { type: 'section', texte: 'Article 1 – Contexte de l’engagement' },
      { type: 'para', texte: o.contexte },
      { type: 'section', texte: 'Article 2 – Objet du contrat' },
      { type: 'para', texte: o.objet },
      { type: 'section', texte: 'Article 3 – Durée du contrat' },
      {
        type: 'para',
        texte:
          'Le présent contrat est conclu pour une durée déterminée de {{duree}}, correspondant à la durée d’exécution d’un marché conclu par l’Employeur. Il prendra effet à compter du {{debut}} et prendra fin automatiquement sans formalité à la date du {{fin}}, sauf résiliation anticipée dans les cas prévus par la loi.',
      },
      { type: 'section', texte: 'Article 4 – Période d’essai' },
      {
        type: 'para',
        texte:
          'Le Salarié effectuera une période d’essai de un (1) mois durant laquelle chacune des parties pourra mettre fin au contrat, sans indemnité, sous réserve du respect du préavis fixé par le Code du travail marocain.',
      },
      { type: 'section', texte: 'Article 5 – Durée et horaires de travail' },
      {
        type: 'para',
        texte:
          'Le Salarié exercera ses fonctions conformément à la législation en vigueur, notamment les dispositions relatives à la durée légale du travail soit {{heures}} heures par Mois réparties selon un planning établi par l’Employeur.',
      },
      { type: 'section', texte: 'Article 6 – Rémunération' },
      {
        type: 'para',
        texte:
          'Le Salarié percevra une rémunération mensuelle brute correspondant au Salaire Minimum Interprofessionnel Garanti (SMIG) en vigueur au Maroc. Cette rémunération pourra être revue en fonction de la législation applicable ou des conditions du marché.',
      },
      { type: 'section', texte: 'Article 7 – Obligations du salarié' },
      {
        type: 'para',
        texte:
          'Le Salarié s’engage à exécuter les tâches qui lui sont confiées avec professionnalisme, à respecter les consignes de sécurité, les horaires et à adopter un comportement conforme aux exigences de son poste et aux règlements intérieurs éventuels.',
      },
      {
        type: 'para',
        texte:
          'L’employé pourra être amené ponctuellement ou temporairement, à se déplacer partout au Maroc ou les nécessités de son travail l’exigeront et notamment en tout autre endroit du Maroc. Toute violation de cette obligation d’exclusivité pourrait entrainer la résiliation du présent contrat pour faute grave.',
      },
      { type: 'section', texte: 'Article 8 – Résiliation' },
      {
        type: 'para',
        texte:
          'Le présent contrat pourra être résilié avant son terme conformément aux dispositions du Code du travail marocain, notamment en cas de faute grave ou de force majeure.',
      },
      { type: 'section', texte: 'Article 9 – Respect des lois et des principes moraux du travail' },
      {
        type: 'para',
        texte:
          'Le Salarié s’engage à respecter les lois, règlements, et principes moraux en vigueur dans l’exercice de ses fonctions. Il est tenu d’agir avec intégrité, respect, et discipline, conformément à l’éthique professionnelle du secteur de la sécurité privée.',
      },
      { type: 'section', texte: 'Article 10 – Exclusivité et non-concurrence' },
      {
        type: 'para',
        texte:
          'Pendant toute la durée du présent contrat, le Salarié s’engage à consacrer l’intégralité de son activité professionnelle à l’Employeur. Il lui est interdit d’exercer toute activité concurrente, directement ou indirectement, sauf accord écrit préalable de l’Employeur.',
      },
      { type: 'section', texte: 'Article 11 – Discrétion et confidentialité' },
      {
        type: 'para',
        texte:
          'Le Salarié est tenu à une obligation de discrétion absolue sur toutes les informations dont il pourrait avoir connaissance dans le cadre de son activité. Cette obligation demeure en vigueur pendant toute la durée du contrat et après sa cessation, quelle qu’en soit la cause.',
      },
      { type: 'section', texte: 'Article 12 – Rupture du contrat' },
      {
        type: 'para',
        texte:
          'Outre les cas de résiliation prévus à l’article 7, le contrat pourra être rompu d’un commun accord entre les parties ou pour tout motif légalement prévu. Toute rupture devra être notifiée par écrit avec les formes et délais prévus par le Code du travail marocain.',
      },
      { type: 'section', texte: 'Article 13 – Compétence juridictionnelle' },
      {
        type: 'para',
        texte:
          'Tout litige relatif à l’interprétation ou à l’exécution du présent contrat sera de la compétence exclusive des juridictions marocaines compétentes dans le ressort du lieu de travail.',
      },
      { type: 'espace' },
      { type: 'para', texte: 'Fait à {{fait_a}}, le {{fait_le}}' },
      { type: 'para', texte: 'En deux exemplaires originaux remis à chacune des parties.' },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  FAMILLE C — le contrat en articles de Vigilma Gard Maroc
// ─────────────────────────────────────────────────────────────────────────

const VIGILMA: ModeleContrat = {
  titre: 'CONTRAT DE TRAVAIL TEMPORAIRE',
  langue: 'fr',
  gauche: 'L’employeur',
  droite: 'L’employé',
  mentionSignature: 'PS : Signature légalisée',
  champs: [
    NOM, CIN, NAISSANCE, ADRESSE, DEBUT, FIN, MARCHE,
    { id: 'essai_debut', label: 'Période d’essai — du', type: 'date' },
    { id: 'essai_fin', label: 'Période d’essai — au', type: 'date' },
    SALAIRE, FAIT_A, FAIT_LE,
  ],
  blocs: [
    { type: 'para', texte: 'Entre :' },
    { type: 'espace' },
    { type: 'section', texte: 'Employeur :' },
    { type: 'para', texte: 'VIGILMA GARD MAROC SARL' },
    { type: 'para', texte: 'Siège social : DRADEB 1 RUE 2 N°35 2ème ÉTAGE, TANGER' },
    { type: 'espace' },
    { type: 'section', texte: 'Et Employé :' },
    { type: 'para', texte: 'Mr. {{nom}}' },
    { type: 'para', texte: 'CIN : {{cin}}' },
    { type: 'para', texte: 'Date de naissance : {{naissance}}' },
    { type: 'para', texte: 'Adresse : {{adresse}}' },
    { type: 'section', texte: 'Article 1 : Objet du Contrat' },
    {
      type: 'para',
      texte:
        'Ce contrat de travail est établi pour répondre à un besoin déterminé de personnel chez un client de VIGILMA GARD MAROC SARL. L’employé sera affecté pour une mission de gardiennage, avec des détails spécifiques sur le lieu et la durée de la mission fournis ultérieurement. Ce contrat couvre uniquement la durée spécifiée ci-dessous et les tâches liées strictement à cette affectation.',
    },
    { type: 'section', texte: 'Article 2 : Durée et Lieu du Contrat' },
    { type: 'para', texte: 'Durée : Le contrat est valable à Partir du {{debut}} au {{fin}}.' },
    { type: 'para', texte: 'Marche n° {{marche}}' },
    {
      type: 'para',
      texte:
        'Période d’essai : Une période d’essai de un mois est établie à compter du début du contrat, soit du {{essai_debut}} au {{essai_fin}}. Pendant cette période, l’employeur ou l’employé peut résilier le contrat sans préavis ni indemnité. Cette période d’essai permet à l’employeur d’évaluer les compétences de l’employé dans l’exercice de ses fonctions et à l’employé de s’assurer que le poste correspond à ses attentes professionnelles. La résiliation du contrat pendant la période d’essai doit être notifiée par écrit. Si la période d’essai se termine sans résiliation, le contrat continue jusqu’à sa date de fin prévue ou jusqu’à une résiliation ultérieure selon les termes établis dans les articles suivants.',
    },
    {
      type: 'para',
      texte:
        'Lieu : L’employé sera principalement affecté chez un client de l’employeur, dont l’adresse sera communiquée avant le début de la mission. Des déplacements occasionnels peuvent être nécessaires selon les besoins de la société.',
    },
    { type: 'section', texte: 'Article 3 : Description de l’Emploi et Obligations de l’Employé' },
    { type: 'para', texte: 'Fonction : AGENT DE SÉCURITÉ' },
    { type: 'para', texte: 'Responsabilités :' },
    {
      type: 'puces',
      items: [
        'Exclusivité d’emploi : L’employé s’engage à ne pas exercer d’autres activités professionnelles, commerciales ou en concurrence avec l’employeur pendant la durée du contrat.',
        'Déplacements : L’employé accepte la possibilité de déplacements temporaires requis par les besoins du service, aussi bien au niveau national qu’international.',
        'Conduite professionnelle : L’employé doit observer une conduite irréprochable, respecter le secret professionnel, la hiérarchie, et maintenir une performance satisfaisante selon les standards de l’employeur.',
      ],
    },
    { type: 'section', texte: 'Article 4 : Rémunération et Avantages' },
    { type: 'para', texte: 'Salaire mensuel brut : {{salaire}} DH.' },
    {
      type: 'para',
      texte:
        'Détails de paiement : Le salaire sera payé mensuellement par virement bancaire au compte fourni par l’employé.',
    },
    { type: 'section', texte: 'Articles 5 : Conditions de Travail' },
    {
      type: 'para',
      texte:
        'Les conditions spécifiques de travail, y compris les horaires et les périodes de repos, seront définies en fonction des besoins du client et communiquées à l’employé à l’avance. L’employeur se réserve le droit de modifier ces conditions en cas de nécessité opérationnelle.',
    },
    { type: 'section', texte: 'Article 6 : Résiliation du Contrat' },
    {
      type: 'para',
      texte:
        'Ce contrat peut être résilié avant la date de fin prévue sans indemnité pour l’employé dans les cas suivants :',
    },
    {
      type: 'puces',
      items: [
        'Réduction ou cessation des activités nécessitant l’emploi de l’employé.',
        'Faute grave de l’employé, conformément à l’article 39 du code du travail.',
        'Circonstances de force majeure, définies selon le droit du travail marocain.',
      ],
    },
    { type: 'section', texte: 'Articles 7 : Solde de Tout Compte et Clôture du Contrat' },
    {
      type: 'para',
      texte:
        'À la fin du contrat ou en cas de résiliation anticipée, l’employé recevra un solde de tout compte qui inclut les congés payés non pris, l’indemnité de préavis, et Indemnités de débouchement selon le nombre des heures équivalents à chaque année d’ancienneté, et sans aucune réclamation d’autres sommes.',
    },
    { type: 'espace' },
    { type: 'para', texte: 'Fait à {{fait_a}}, le {{fait_le}}' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────
//  FAMILLE D — le contrat en arabe — Al Safae El Maghreb, Eden Vert
//
//  Le document se lit de droite à gauche ; les valeurs saisies restent en
//  caractères latins et sont isolées à l'affichage pour ne pas désordonner
//  la ligne autour d'elles.
// ─────────────────────────────────────────────────────────────────────────

function familleD(cooperative: string, siege: string, metier: string, objet: string): ModeleContrat {
  return {
    titre: 'عقد عمل محدد المدة مرتبط بمشروع',
    langue: 'ar',
    gauche: `توقيع التعاونية ${cooperative}`,
    droite: 'توقيع الأجيرة',
    // Les mentions qui se tapent en arabe portent leur intitulé arabe :
    // sans cela deux champs « Fait à » se retrouvent dans le formulaire,
    // l'un pour la base, l'autre pour le document.
    champs: [
      { id: 'marche', label: 'رقم الصفقة — Marché n°', type: 'texte' },
      { id: 'nom', label: 'اسم الأجيرة — Nom, en arabe', type: 'texte' },
      CIN, NAISSANCE,
      { id: 'adresse', label: 'العنوان — Domicile, en arabe', type: 'long' },
      DEBUT, FIN,
      { id: 'heures', label: 'ساعة شهريا — Heures par mois', type: 'nombre' },
      SALAIRE,
      { id: 'fait_a', label: 'حرر بـ — Fait à, en arabe', type: 'texte' },
      FAIT_LE,
    ],
    blocs: [
      { type: 'section', texte: 'المادة 1- سياق التعاقد' },
      {
        type: 'para',
        texte: `يأتي هذا العقد في إطار تنفيذ صفقة ${metier} مبرمة بين المشغل وطرف ثالث لمدة ثلاث سنوات. وقد تم توظيف الأجيرة خصيصاً لتلبية احتياجات هذه الصفقة. وقد تؤثر أي تعديلات في وضعية الصفقة على العلاقة التعاقدية، وفقاً لما تنص عليه التشريعات المعمول بها.`,
      },
      { type: 'puces', items: [
        `التعاونية : ${cooperative} الكائن ${siege}`,
        'الصفقة المبرمة رقم : {{marche}}',
        'الأجيرة : السيدة {{nom}} الحاملة لبطاقة التعريف الوطنية {{cin}} تاريخ الازدياد {{naissance}} الكائن عنوانها {{adresse}}',
      ] },
      { type: 'section', texte: 'المادة 2- موضوع العقد' },
      { type: 'para', texte: objet },
      { type: 'section', texte: 'المادة 3- مدة العقد' },
      {
        type: 'para',
        texte:
          'تم إبرام هذا العقد لمدة محددة قدرها ثلاث سنوات، تتوافق مع مدة تنفيذ الصفقة التي أبرمها المشغل. ويبدأ سريانه من تاريخ {{debut}} وينتهي تلقائياً دون إجراءات إضافية بتاريخ {{fin}}، ما لم يتم فسخه مسبقاً في الحالات المنصوص عليها قانوناً.',
      },
      { type: 'section', texte: 'المادة 4- فترة التجربة' },
      {
        type: 'para',
        texte:
          'تخضع الأجيرة لفترة تجربة مدتها ثمانية أيام، يجوز خلالها لأي من الطرفين إنهاء العقد دون تعويض، مع احترام مهلة الإشعار المنصوص عليها في مدونة الشغل المغربية.',
      },
      { type: 'section', texte: 'المادة 5- مدة وساعات العمل' },
      {
        type: 'para',
        texte:
          'تمارس الأجيرة مهامها طبقاً للتشريعات الجاري بها العمل، لا سيما تلك المتعلقة بالمدة القانونية للعمل والمحددة في {{heures}} ساعة شهرياً، موزعة وفق جدول زمني يحدده المشغل.',
      },
      { type: 'section', texte: 'المادة 6- الأجر' },
      {
        type: 'para',
        texte:
          'تتقاضى الأجيرة أجراً شهرياً إجمالياً {{salaire}} يعادل الحد الأدنى للأجر المضمون (SMIG) المعمول به في المغرب. ويجوز مراجعة هذا الأجر وفقاً للتشريعات السارية أو شروط الصفقة.',
      },
      { type: 'section', texte: 'المادة 7- التزامات الأجيرة' },
      {
        type: 'para',
        texte:
          'تتعهد الأجيرة بأداء المهام المسندة إليها باحتراف واحترام تعليمات السلامة والانضباط الزمني واعتماد سلوك يتماشى مع متطلبات منصبها والنظم الداخلية المحتملة. قد يُطلب من الأجيرة أحياناً أو لمدة محددة إلى تغيير مكان عملها حسب احتياجات المشغل. أي انتهاك لهذا الالتزام الحصري يمكن أن يؤدي إلى إنهاء هذا العقد.',
      },
      { type: 'section', texte: 'المادة 8- فسخ العقد' },
      {
        type: 'para',
        texte:
          'يمكن فسخ هذا العقد قبل انتهاء مدته طبقاً لأحكام مدونة الشغل المغربية، وخاصة في حالة الخطأ الجسيم أو القوة القاهرة.',
      },
      { type: 'section', texte: 'المادة 9- احترام القوانين والمبادئ الأخلاقية للعمل' },
      {
        type: 'para',
        texte: `تلتزم الأجيرة باحترام القوانين والتنظيمات والمبادئ الأخلاقية الجاري بها العمل خلال مزاولة مهامها، والتصرف بنزاهة واحترام وانضباط، تماشياً مع الأخلاقيات المهنية لميدان ${metier}.`,
      },
      { type: 'section', texte: 'المادة 10- الحصرية وعدم المنافسة' },
      {
        type: 'para',
        texte:
          'تتعهد الأجيرة طيلة مدة هذا العقد بتكريس كامل نشاطها المهني لفائدة المشغل. ويمنع عليها مزاولة أي نشاط تنافسي بشكل مباشر أو غير مباشر، إلا بموافقة كتابية مسبقة من المشغل.',
      },
      { type: 'section', texte: 'المادة 11- السرية والكتمان' },
      {
        type: 'para',
        texte:
          'تلتزم الأجيرة بسرية تامة تجاه جميع المعلومات التي قد تطلع عليها خلال مزاولة عملها، ويستمر هذا الالتزام طيلة مدة العقد وحتى بعد انتهائه، مهما كان سبب الانتهاء.',
      },
      { type: 'section', texte: 'المادة 12- إنهاء العقد' },
      {
        type: 'para',
        texte:
          'بالإضافة إلى حالات الفسخ المنصوص عليها في المادة 8، يمكن إنهاء العقد باتفاق الطرفين أو لأي سبب آخر مشروع. ويجب تبليغ الفسخ كتابةً مع مراعاة الشكليات والآجال المنصوص عليها في مدونة الشغل.',
      },
      { type: 'espace' },
      { type: 'para', texte: 'حرر بـ {{fait_a}} التاريخ {{fait_le}}' },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  LE REGISTRE — quel modèle pour quelle société
// ─────────────────────────────────────────────────────────────────────────

const MODELES: Record<string, ModeleContrat> = {
  'BO': familleA({
    titre: 'CONTRAT DE TRAVAIL DETERMINEE',
    societe:
      'Société : B.O NETTOYAGE S.A.R.L à responsabilité limitée sise : Lot Florencia Imm10 Appt N°4, 2eme Etage Route de Rabat-Tanger',
    representant: 'Représentée par la Gérante Mme. BAHIA ALAOUI AMRANI.',
    civilite: 'Mme.',
    effet: 'Le présent contrat prend effet à compter du {{debut}}. Il prend fin le {{fin}}.',
    duree: 'Une durée de travail fixée par l’employeur ;',
    remuneration: 'Une rémunération de {{salaire}} DH Brut',
    fonction: 'AGENT DE NETTOYAGE',
  }),

  'DUO MULTI SERVICE': familleA({
    titre: 'CONTRAT DE TRAVAIL TEMPORAIRE',
    societe:
      'Société : DUO MULTI SERVICE SARL à responsabilité limitée sise : AV MLY YOUSSEF IMM AL FATH BLOC A 5EME ETG NO 17 TANGER.',
    representant: 'Représentée par le Gérant Mr. BENSLAMA SOUANI AYOUB',
    civilite: 'Mme.',
    effet: 'Le présent contrat prend effet à compter du {{debut}}. Il prend fin le {{fin}}.',
    duree: 'Une durée de travail fixée par l’employeur',
    remuneration: 'Une rémunération de {{salaire}} DH BRUT.',
    fonction: 'AGENT DE NETTOYAGE',
    faitA: 'Tanger',
  }),

  'GROUPE TRIPLE A': familleA({
    titre: 'CONTRAT DE TRAVAIL TEMPORAIRE',
    societe:
      'Société : GROUPE TRIPLE AAA à responsabilité limitée sise : Lot Florencia Imm 10 Apt 2 Etage 01 Rte de Rabat Av des F.A.R -Tanger',
    representant: 'Représenté par le Gérant Monsieur. BENSLAMA SOUANI OMAR.',
    civilite: 'Monsieur.',
    avecMarche: true,
    effet:
      'Le présent contrat prend effet à compter du marché {{marche}} à Partir du {{debut}}. Il prend fin le {{fin}}.',
    duree: 'Horaire de travail fixé par l’employeur ;',
    remuneration: 'Une rémunération de {{salaire}}',
    fonction: 'AGENT DE SECURITE',
  }),

  'MEGAINTER SERVICE MAROC': familleA({
    titre: 'CONTRAT DE TRAVAIL TEMPORAIRE',
    societe:
      'Société : MEGAINTER SERVICE MAROC à responsabilité limitée associe unique sise : Rés Chaouia Av Youssef Ibn Tachfine Rue Rachid Reda 4éme Etg N°21-Tanger.',
    representant: 'Représenté par le Gérant Monsieur. CHCHOUYEKH OSSAMA.',
    civilite: 'Madame.',
    avecMarche: true,
    effet:
      'Le présent contrat prend effet à compter du marché N° {{marche}} à Partir du {{debut}}. Il prend fin le {{fin}}.',
    duree: 'Horaire de travail fixée par l’employeur ;',
    remuneration: 'Une rémunération de {{salaire}} DH BRUT',
    fonction: 'AGENT {{fonction}}',
  }),

  'NORD PLANET': familleA({
    titre: 'CONTRAT DE TRAVAIL TEMPORAIRE',
    societe:
      'Société : NORD PLANET NEGOCE S.A.R.L à responsabilité limitée sise : 05 Complexe Panamaribo Rés Rachid 2eme Etage Immb 09 Rte Asilah Tanger.',
    representant: 'Représentée par la Gérante Mme. SARA AGDOUH.',
    civilite: 'Mme.',
    avecMarche: true,
    effet:
      'Le présent contrat prend effet à compter du Marche N° {{marche}} à partir {{debut}}. Il prend fin le {{fin}}.',
    duree: 'Une durée de travail fixée par l’employeur ;',
    remuneration: 'Une rémunération de {{salaire}} BRUT.',
    fonction: 'AGENT DE NETTOYAGE',
  }),

  'TRIMAX': familleB({
    societe:
      'La société TRIMAX SURVEILLANCE SARL, société spécialisée en gardiennage, dont le siège social est situé à 12 COMP AL FIRDAOUS IMM 12 ETAGE 05 N°18 TANGER, représentée par Mme ALAOUI AMRANI BAHIA, en qualité de Gérante, ci-après dénommée « l’Employeur »,',
    civilite: 'Mr.',
    denomination: 'le Salarié',
    contexte:
      'Le présent contrat s’inscrit dans le cadre de l’exécution d’un marché {{marche}} de gardiennage conclu entre l’Employeur et un donneur d’ordre pour une durée de trois ans. Le Salarié est embauché spécifiquement pour les besoins de ce marché. Toute modification de la situation du marché pourra avoir un impact sur la relation contractuelle, dans les conditions prévues par la législation applicable.',
    objet:
      'L’Employeur engage le Salarié en qualité d’Agent de sécurité pour assurer des missions de surveillance sur un chantier. Le Salarié pourra être affecté à différents points de contrôle ou de garde au sein du même chantier selon les besoins de l’Employeur.',
  }),

  'SERCLEAN NEGOCE': familleB({
    societe:
      'La société SERCLEAN NEGOCE SARL AU, dont le siège social est situé à Rue de Russie Rés Nil Bloc C N°06 B Tanger, représentée par Mr BENSLAMA SOUANI Omar, en qualité de Gérant, ci-après dénommée « l’Employeur »,',
    civilite: 'Mme.',
    denomination: 'L’employé',
    contexte:
      'Le présent contrat s’inscrit dans le cadre de l’exécution d’un marché {{marche}} conclu entre l’Employeur et un donneur d’ordre pour une durée de trois ans. Le Salarié est embauché spécifiquement pour les besoins de ce marché. Toute modification de la situation du marché pourra avoir un impact sur la relation contractuelle, dans les conditions prévues par la législation applicable.',
    objet:
      'L’Employeur engage le Salarié en qualité d’Agent {{fonction}} pour assurer des missions de réception sur un chantier. Le Salarié pourra être affecté à différents points selon les besoins de l’Employeur.',
    fonctionChamp: true,
  }),

  'VIGILMA GARD MAROC': VIGILMA,

  'AL SAFAE EL MAGHREB': familleD(
    'AL SAFAE EL MAGHREB',
    'درادب 1 زنقة 2 رقم 35 الطابق الثالث طنجة',
    'النظافة',
    'يقوم المشغل بتوظيف الأجيرة بصفتها عاملة نظافة للقيام بمهام التنظيف في أماكن مختلفة، ويجوز تكليف الأجيرة بمواقع أخرى حسب احتياجات المشغل.',
  ),

  'EDEN VERT SERVICE': familleD(
    'EDEN VERT SERVICE',
    'طنجة',
    'النظافة',
    'يقوم المشغل بتوظيف الأجيرة بصفتها عاملة نظافة للقيام بمهام التنظيف في أماكن مختلفة، ويجوز تكليف الأجيرة بمواقع أخرى حسب احتياجات المشغل.',
  ),
}

/** Comparaison insensible à la casse, aux accents et à la ponctuation. */
function cle(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

const PAR_CLE = new Map(Object.entries(MODELES).map(([k, v]) => [cle(k), v]))

// Même société, deux graphies selon qu'on lise la base ou le papier.
PAR_CLE.set(cle('MEGANTER SERVICE MAROC'), MODELES['MEGAINTER SERVICE MAROC'])

/** Le modèle de contrat d'une société, ou null si elle n'en a pas encore. */
export function modeleContrat(entreprise: string | null | undefined): ModeleContrat | null {
  if (!entreprise) return null
  return PAR_CLE.get(cle(entreprise)) ?? null
}

export function entreprisesAvecContrat(): string[] {
  return Object.keys(MODELES)
}

/**
 * Les jetons réellement présents dans un modèle.
 *
 * Tous les champs d'un formulaire ne finissent pas sur le papier : le
 * contrat de BO ne mentionne ni période d'essai, ni mode de règlement.
 * Savoir lesquels s'impriment évite de chercher pourquoi « rien ne change
 * quand je tape ».
 */
export function jetonsDuModele(modele: ModeleContrat | null): Set<string> {
  const vus = new Set<string>()
  if (!modele) return vus
  const lire = (t: string) => {
    for (const m of t.matchAll(/\{\{(\w+)\}\}/g)) vus.add(m[1])
  }
  for (const b of modele.blocs) {
    if (b.type === 'puces') b.items.forEach(lire)
    else if (b.type !== 'espace') lire(b.texte)
  }
  return vus
}

/** Remplace les jetons par les valeurs saisies. Un champ vide reste en pointillés. */
export function remplir(texte: string, valeurs: Record<string, string>): string {
  return texte.replace(/\{\{(\w+)\}\}/g, (_, id: string) => {
    const v = valeurs[id]
    return v && v.trim() ? v.trim() : '……………………'
  })
}
