exports.handler = async (event) => {
  const headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json"};
  if (event.httpMethod === "OPTIONS") return {statusCode: 200, headers, body: ""};
  
  try {
    const {dj, venue, date, start, end, fee, rider, clauses} = JSON.parse(event.body);
    if (!dj || !venue) return {statusCode: 400, headers, body: JSON.stringify({detail: "Nom DJ et Venue requis."})};
    
    const deposit = Math.round(fee * 0.5 * 100) / 100;
    const balance = Math.round((fee - deposit) * 100) / 100;
    const today = new Date().toLocaleDateString('fr-FR');
    
    const contract = `###SECTION_1: IDENTIFICATION DES PARTIES###
Le présent contrat est conclu entre :
- L'Artiste (DJ) : ${dj}
- L'Organisateur (Venue) : ${venue}

###SECTION_2: OBJET DU CONTRAT###
L'Artiste s'engage à fournir une prestation de DJ (disc-jockey) pour l'événement organisé par l'Organisateur selon les modalités définies ci-après.

###SECTION_3: DATE ET HORAIRES###
Date de l'événement : ${date || 'À confirmer'}
Horaires de prestation : ${start || '23:00'} - ${end || '05:00'}
L'Artiste s'engage à être présent 30 minutes avant le début de sa prestation pour l'installation.

###SECTION_4: RÉMUNÉRATION###
Cachet total : ${fee || 0}€ TTC
- Acompte (50%) : ${deposit}€ - payable à la signature du présent contrat
- Solde (50%) : ${balance}€ - payable après validation de la prestation
Le paiement s'effectue via la plateforme sécurisée CUE (Stripe).

###SECTION_5: RIDER TECHNIQUE###
${rider || "L'Organisateur met à disposition :\n- 2 platines CDJ-2000NXS2 ou équivalent\n- 1 table de mixage DJM-900NXS2 ou équivalent\n- Système de monitoring adapté\n- Connexions électriques sécurisées"}

###SECTION_6: OBLIGATIONS DE L'ORGANISATEUR###
L'Organisateur s'engage à :
- Fournir l'équipement technique spécifié dans le rider
- Assurer la sécurité de l'Artiste pendant l'événement
- Respecter les horaires convenus
- Fournir un accès backstage/loge si disponible
- Prendre en charge les frais de déplacement si convenus

###SECTION_7: OBLIGATIONS DE L'ARTISTE###
L'Artiste s'engage à :
- Se présenter à l'heure convenue avec son matériel personnel
- Fournir une prestation professionnelle de qualité
- Respecter la programmation musicale convenue
- Adapter son set à l'ambiance et au public
- Respecter les niveaux sonores réglementaires

###SECTION_8: ANNULATION###
En cas d'annulation par l'Organisateur :
- Plus de 30 jours avant : remboursement intégral de l'acompte
- Entre 15 et 30 jours : 50% de l'acompte conservé par l'Artiste
- Moins de 15 jours : acompte intégralement conservé par l'Artiste

En cas d'annulation par l'Artiste :
- L'acompte est intégralement remboursé à l'Organisateur
- L'Artiste s'engage à proposer un remplaçant de niveau équivalent si possible

###SECTION_9: CLAUSES PARTICULIÈRES###
${clauses || "Aucune clause particulière."}

###SECTION_10: SIGNATURES###
Fait en deux exemplaires, le ${today}

Pour l'Artiste : ${dj}
Signature : _______________________

Pour l'Organisateur : ${venue}
Signature : _______________________

---
Contrat généré via CUE - La plateforme de booking DJ
www.cuedj.eu`;

    return {statusCode: 200, headers, body: JSON.stringify({contract_text: contract})};
  } catch (e) {
    return {statusCode: 500, headers, body: JSON.stringify({detail: e.message})};
  }
};
