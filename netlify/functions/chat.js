const FAQ_DATA = [
  // ═══════════════════════════════════════════════════════════════
  // SALUTATIONS - Français, Anglais, Espagnol, Italien, Portugais
  // ═══════════════════════════════════════════════════════════════
  {k: ["bonjour", "salut", "hello", "hey", "coucou", "yo", "hi", "bjr", "slt", "bonsoir", "hola", "buongiorno", "ciao", "ola", "oi", "bom dia", "buenas", "buenos dias", "salve", "helo", "kumusta", "magandang", "marhaba", "salam"], r: "Hey ! 👋 Bienvenue sur CUE ! Je suis MAX, ton assistant. Comment je peux t'aider aujourd'hui ? 🎧"},
  {k: ["merci", "thanks", "thank you", "gracias", "grazie", "obrigado", "salamat", "cool merci", "super merci", "parfait merci", "thx", "ty", "merci beaucoup", "mille grazie"], r: "Avec plaisir ! 😊 Si tu as d'autres questions, je suis là. Bonne continuation sur CUE ! 🎧🎉"},
  {k: ["bye", "revoir", "ciao", "adios", "arrivederci", "tchao", "a plus", "goodbye", "see you", "adeus", "paalam", "au revoir", "bonne journee", "bonne soiree"], r: "À bientôt ! 👋 N'hésite pas si tu as d'autres questions. Bonne continuation sur CUE ! 🎧🎉"},
  {k: ["ca va", "comment vas", "how are", "como estas", "come stai", "tudo bem", "kamusta ka", "quoi de neuf", "la forme"], r: "Ça va super, merci ! 😊 Je suis MAX, prêt à t'aider avec CUE. Qu'est-ce que tu veux savoir ? 🎧"},

  // ═══════════════════════════════════════════════════════════════
  // C'EST QUOI CUE - Questions générales
  // ═══════════════════════════════════════════════════════════════
  {k: ["c'est quoi cue", "cue c'est quoi", "quoi cue", "kesako", "what is cue", "que es cue", "cos'e cue", "o que e cue", "definition cue", "cue definition", "presente cue", "expliquez cue", "cue explain"], r: "CUE est LA plateforme qui connecte les DJs avec les clubs, agences, mariages et événements privés. On propose : 🎯 Matching IA pour trouver le DJ parfait, 📋 Génération de contrats en 30 secondes, 💳 Paiements sécurisés via Stripe. Bref, on simplifie le booking DJ de A à Z ! 🎧"},
  {k: ["comment ca marche", "comment fonctionne", "how does it work", "como funciona", "come funziona", "funcionamento", "marche comment", "expliquez fonctionnement", "utiliser cue", "how to use"], r: "C'est simple ! 1️⃣ Créez votre profil (DJ ou Venue). 2️⃣ Utilisez notre matching IA pour trouver le partenaire idéal. 3️⃣ Générez un contrat pro en 30 secondes. 4️⃣ Paiement sécurisé via Stripe. 5️⃣ Événement validé = DJ payé. Terminé les galères ! 🚀"},
  {k: ["pourquoi cue", "avantages cue", "why cue", "benefices", "benefits", "interet", "c'est bien cue", "cue vs autres"], r: "Pourquoi CUE ? ✅ Matching IA intelligent (fini les mauvaises surprises). ✅ Contrats générés en 30 sec (plus de paperasse). ✅ Paiements sécurisés Stripe (DJ payé après validation). ✅ Profils vérifiés (confiance garantie). ✅ Plateforme tout-en-un. On révolutionne le booking DJ ! 🚀"},
  {k: ["qui a cree cue", "fondateur", "founder", "createur", "who created", "equipe cue", "team"], r: "CUE a été créé par une équipe passionnée de musique et de tech qui en avait marre des galères du booking DJ. Notre mission : simplifier la vie des DJs et des organisateurs ! 🎧💡"},

  // ═══════════════════════════════════════════════════════════════
  // TARIFS & PRIX
  // ═══════════════════════════════════════════════════════════════
  {k: ["prix", "tarif", "cout", "coute", "combien", "price", "pricing", "precio", "prezzo", "quanto costa", "cuanto cuesta", "how much", "gratuit", "free", "gratis", "payant", "abonnement", "subscription"], r: "On a 3 formules : 🆓 **Starter** : Gratuit (7% commission par booking). ⭐ **Pro DJ** : 29€/mois (3% commission + badge Pro + priorité matching). 🏢 **Business** : 149€/mois (0% commission + multi-users + API). Tu peux commencer gratuitement ! 💰"},
  {k: ["commission", "frais", "pourcentage", "fees", "percentage", "comision", "commissione"], r: "La commission dépend de ton plan : 🆓 Starter (gratuit) → 7% par booking. ⭐ Pro DJ (29€/mois) → 3% seulement. 🏢 Business (149€/mois) → 0% commission. Plus tu montes, moins tu paies ! 📊"},
  {k: ["starter", "plan gratuit", "free plan", "offre gratuite", "formule starter"], r: "Le plan **Starter** c'est notre offre gratuite ! Tu as : profil DJ complet, accès au matching, paiements sécurisés, et support email. On prend juste 7% de commission quand tu décroches un booking. Parfait pour commencer ! 🎯"},
  {k: ["pro dj", "plan pro", "formule pro", "abonnement pro", "pro plan"], r: "Le plan **Pro DJ** à 29€/mois c'est pour les DJs sérieux ! Tu as : seulement 3% de commission, badge 'Pro' sur ton profil, priorité dans le matching IA, contrats illimités, et analytics avancés. Tu rentabilises vite ! ⭐"},
  {k: ["business", "entreprise", "agence", "agency", "plan business", "empresa"], r: "Le plan **Business** à 149€/mois c'est pour les agences et pros : 0% commission (!), multi-utilisateurs, accès API, et account manager dédié. Si tu fais beaucoup de bookings, c'est ultra rentable ! 🏢"},
  {k: ["essai", "trial", "tester", "test gratuit", "free trial", "prueba"], r: "Tu peux tester CUE gratuitement avec le plan Starter ! Pas de carte bancaire requise, pas d'engagement. Tu upgrades quand tu veux. 🎉"},

  // ═══════════════════════════════════════════════════════════════
  // COMPTE & INSCRIPTION
  // ═══════════════════════════════════════════════════════════════
  {k: ["inscrire", "inscription", "register", "sign up", "creer compte", "crear cuenta", "registrarse", "registrarsi", "cadastrar", "rejoindre", "join"], r: "Pour t'inscrire : clique sur 'Join CUE' en haut de la page, choisis ton profil (DJ ou Venue), remplis tes infos, et c'est parti ! L'inscription est gratuite et prend 2 minutes. 🎉"},
  {k: ["connecter", "connexion", "login", "log in", "iniciar sesion", "accedi", "entrar", "sign in", "me connecter"], r: "Pour te connecter : clique sur 'Login' en haut, entre ton email et mot de passe, et c'est bon ! Si tu as oublié ton mdp, clique sur 'Mot de passe oublié'. 🔐"},
  {k: ["mot de passe oublie", "password forgot", "mdp oublie", "reset password", "recuperar contrasena", "recuperar senha", "forgot password", "reinitialiser"], r: "Mot de passe oublié ? Clique sur 'Mot de passe oublié' sur la page de connexion, entre ton email, et tu recevras un lien pour le réinitialiser. Check tes spams aussi ! 🔑"},
  {k: ["changer mot de passe", "change password", "modifier mdp", "cambiar contrasena", "cambiare password", "nouveau mdp"], r: "Pour changer ton mot de passe : va dans ton Profil → Settings → Sécurité → 'Modifier le mot de passe'. Facile ! 🔐"},
  {k: ["supprimer compte", "delete account", "effacer compte", "eliminar cuenta", "eliminare account", "fermer compte", "desinscrire"], r: "Tu veux nous quitter ? 😢 Va dans Settings → Confidentialité → 'Supprimer mon compte'. Attention, c'est irréversible ! Contacte-nous d'abord si tu as un souci : cue.dj.app@gmail.com"},
  {k: ["modifier profil", "edit profile", "changer infos", "update profile", "modifier informations", "cambiar perfil", "modificare profilo"], r: "Pour modifier tes infos : Dashboard → 'Mon Profil' → clique sur ce que tu veux modifier (bio, photo, genres...). N'oublie pas de sauvegarder ! ✏️"},
  {k: ["email pas recu", "mail pas recu", "no email", "pas de mail", "email perdu", "no recibi email", "non ho ricevuto"], r: "L'email joue à cache-cache ? 📧 Vérifie tes spams/courriers indésirables. Attends quelques minutes. Toujours rien ? Contacte-nous : cue.dj.app@gmail.com"},
  {k: ["probleme connexion", "can't login", "impossible connecter", "no puedo entrar", "non riesco ad accedere", "login marche pas"], r: "Problème de connexion ? 🔐 Vérifie ton email et mot de passe. Essaie 'Mot de passe oublié'. Vide le cache de ton navigateur. Toujours bloqué ? Contacte : cue.dj.app@gmail.com"},

  // ═══════════════════════════════════════════════════════════════
  // PROFIL DJ
  // ═══════════════════════════════════════════════════════════════
  {k: ["profil dj", "optimiser profil", "ameliorer profil", "dj profile", "meilleur profil", "perfil dj", "profilo dj", "bon profil"], r: "Pour un profil DJ au top : 📸 Photo pro de qualité. 🎵 Ajoute tes genres musicaux. 📝 Bio percutante. 🎧 Liens vers tes mixes. ⭐ Collecte des avis. 📅 Mets tes dispos à jour. Plus c'est complet, plus tu matches ! 🚀"},
  {k: ["genres musicaux", "style musical", "type musique", "music genre", "genero musical", "genere musicale", "ajouter genre"], r: "Pour ajouter tes genres : Dashboard → Mon Profil → 'Genres musicaux' → sélectionne tes styles (House, Techno, Hip-Hop, etc.). Tu peux en choisir plusieurs ! 🎵"},
  {k: ["disponibilites", "calendrier", "dispo", "calendar", "disponibilidad", "disponibilita", "dates libres", "availability"], r: "Pour gérer tes dispos : Dashboard → Calendrier → clique sur les dates. Les venues voient en temps réel quand tu es libre. Mets-le à jour régulièrement ! 📅"},
  {k: ["badge pro", "verified badge", "certification", "badge verifie", "distintivo pro"], r: "Le badge Pro ⭐ apparaît quand tu as l'abonnement Pro DJ (29€/mois). Il montre que tu es sérieux et tu apparais en priorité dans le matching !"},
  {k: ["profil en attente", "profile pending", "validation profil", "verification profil", "perfil pendiente", "profilo in attesa"], r: "Ton profil est en cours de vérification. Ça prend généralement quelques minutes à quelques heures. On vérifie ton identité pour garantir la qualité sur CUE. Patience ! ⏳"},
  {k: ["ajouter photo", "upload photo", "changer photo", "profile picture", "foto perfil"], r: "Pour ajouter/changer ta photo : Dashboard → Mon Profil → clique sur ta photo actuelle → Upload une nouvelle. Choisis une photo pro et de qualité ! 📸"},
  {k: ["ajouter mix", "upload mix", "soundcloud", "mixcloud", "lien mix", "musique"], r: "Pour ajouter tes mixes : Dashboard → Mon Profil → Section 'Mixes/Liens' → colle tes liens SoundCloud, Mixcloud ou YouTube. Les venues adorent écouter avant de booker ! 🎵"},

  // ═══════════════════════════════════════════════════════════════
  // PROFIL VENUE
  // ═══════════════════════════════════════════════════════════════
  {k: ["profil venue", "creer venue", "venue profile", "profil club", "perfil venue", "profilo venue", "organisateur"], r: "Pour créer un profil Venue : 'Join CUE' → 'I am a Venue' → remplis tes infos (nom, lieu, capacité, styles, équipement). Les DJs pourront te trouver ! 🏢"},
  {k: ["fiche technique", "technical rider", "rider technique", "equipement", "equipment", "sono", "materiel", "dj booth"], r: "La fiche technique décrit ton équipement : 🔊 Système son. 🎛️ DJ booth (platines, mixeur). 💡 Éclairage. Plus c'est détaillé, mieux c'est pour les DJs !"},
  {k: ["publier evenement", "create event", "poster event", "chercher dj", "nueva fecha", "nuovo evento", "creer event"], r: "Pour publier un event : Dashboard → 'Créer événement' → date, horaires, budget, styles recherchés. Les DJs correspondants seront notifiés ! 📣"},
  {k: ["choisir dj", "select dj", "trouver dj", "find dj", "buscar dj", "trovare dj", "quel dj"], r: "Pour choisir un DJ : 👀 Consulte les profils. 🎧 Écoute leurs mixes. ⭐ Lis les avis. 💬 Contacte-les via CUE. Notre matching IA peut aussi t'aider ! 🎯"},

  // ═══════════════════════════════════════════════════════════════
  // MATCHING IA
  // ═══════════════════════════════════════════════════════════════
  {k: ["matching", "algorithme", "ia", "ai", "intelligence artificielle", "artificial intelligence", "trouver automatique", "match"], r: "Notre matching IA analyse ton événement (type, vibe, budget, lieu) et te propose les DJs les plus compatibles avec un score de match. Plus besoin de chercher pendant des heures ! 🎯🤖"},
  {k: ["utiliser matching", "how to match", "lancer matching", "usar matching", "come funziona matching", "faire matching"], r: "Va dans 'Find a DJ' → décris ton event (type, ambiance, budget, ville) → clique 'Find DJs' → notre IA te propose les meilleurs profils. Magic ! ✨"},
  {k: ["matching fiable", "matching precis", "match accurate", "matching works", "ca marche matching"], r: "Notre matching analyse : genres, expérience, avis, localisation, budget, style... Plus tu donnes de détails, plus c'est précis. 90%+ de satisfaction ! 🎯"},

  // ═══════════════════════════════════════════════════════════════
  // CONTRATS
  // ═══════════════════════════════════════════════════════════════
  {k: ["contrat", "contract", "generer contrat", "create contract", "contrato", "contratto", "faire contrat"], r: "Génère un contrat en 30 sec ! 'Generate Contract' → nom DJ, venue, date, horaires, cachet, rider → 'Generate'. Tu obtiens un contrat pro en 10 sections ! 📋"},
  {k: ["contenu contrat", "sections contrat", "contract content", "que contiene contrato", "cosa contiene contratto"], r: "Nos contrats : 1️⃣ Parties 2️⃣ Objet 3️⃣ Date/Horaires 4️⃣ Rémunération 5️⃣ Rider technique 6️⃣ Obligations venue 7️⃣ Obligations DJ 8️⃣ Annulation 9️⃣ Clauses 🔟 Signatures. Tout est carré ! ⚖️"},
  {k: ["contrat legal", "legally valid", "valeur juridique", "legally binding", "contrato legal", "contratto legale"], r: "Nos contrats suivent les standards juridiques français. Ils ont valeur légale une fois signés. Pour des cas complexes, consulte un avocat. ⚖️"},
  {k: ["rider", "technical rider", "rider dj", "fiche technique dj", "equipement necessaire"], r: "Le rider liste ce dont le DJ a besoin : 🎛️ Platines. 🎚️ Mixeur. 🎧 Monitoring. 🔌 Branchements. Spécifie-le dans le contrat ! 🎧"},
  {k: ["signer contrat", "sign contract", "signature", "firmar contrato", "firmare contratto"], r: "Une fois le contrat généré, les deux parties (DJ et Venue) peuvent le signer électroniquement via CUE. Simple et légal ! ✍️"},

  // ═══════════════════════════════════════════════════════════════
  // BOOKING & RÉSERVATION
  // ═══════════════════════════════════════════════════════════════
  {k: ["booking", "reservation", "reserver", "reservar", "prenotare", "book dj", "reserva"], r: "Processus booking : 1️⃣ Demande 2️⃣ DJ accepte 3️⃣ Paiement acompte 4️⃣ Contrat signé 5️⃣ Événement 6️⃣ Validation 7️⃣ DJ payé. Tout est tracé et sécurisé ! ✅"},
  {k: ["annuler", "cancel", "annulation", "cancelar", "annullare", "cancel booking"], r: "Pour annuler : Mes Bookings → sélectionne → 'Annuler'. Les conditions d'annulation du contrat s'appliquent pour l'acompte. 📝"},
  {k: ["modifier booking", "change booking", "modifier reservation", "cambiar reserva", "modificare prenotazione"], r: "Tu peux modifier un booking (date, horaires, cachet) mais ça doit être validé par les deux parties via la messagerie CUE. 🤝"},
  {k: ["no show", "dj absent", "dj pas venu", "dj ne vient pas", "dj didn't show", "dj no vino"], r: "Si le DJ ne vient pas : signale-le immédiatement depuis le booking. Tu es remboursé et le DJ est sanctionné. C'est pour ça qu'on vérifie les profils ! 🚨"},
  {k: ["contacter dj", "contact dj", "message dj", "chat dj", "parler dj", "contactar dj", "contattare dj"], r: "Utilise le chat intégré CUE pour communiquer. Ça garde une trace officielle en cas de litige. Pas d'échanges hors plateforme ! 💬"},
  {k: ["confirmer booking", "confirm booking", "accepter booking", "confirmar reserva", "confermare prenotazione"], r: "Quand tu reçois une demande de booking, tu as 48h pour accepter ou refuser. Va dans Mes Bookings → Demandes en attente → Accepter/Refuser. ✅"},

  // ═══════════════════════════════════════════════════════════════
  // PAIEMENTS
  // ═══════════════════════════════════════════════════════════════
  {k: ["paiement", "payment", "payer", "pay", "pago", "pagamento", "stripe", "securise", "secure"], r: "Les paiements passent par **Stripe**, 100% sécurisé. 🔒 L'argent est protégé jusqu'à validation de l'event. Le DJ est payé après confirmation de la prestation. Zéro risque ! 💳"},
  {k: ["quand paye", "when paid", "dj paye quand", "cuando pagan", "quando pagano", "virement dj"], r: "Le DJ est payé en 2 temps : 💰 Acompte (50%) à la signature. 💰 Solde (50%) après validation par la venue. Virement sous 2-5 jours ouvrés."},
  {k: ["paiement refuse", "payment declined", "carte refusee", "pago rechazado", "pagamento rifiutato", "erreur paiement"], r: "Paiement refusé ? Vérifie : 💳 Numéro de carte. 📅 Date d'expiration. 🔐 3D Secure activé. 💶 Solde suffisant. Essaie une autre carte si besoin."},
  {k: ["facture", "invoice", "telecharger facture", "descargar factura", "scaricare fattura", "receipt"], r: "Pour tes factures : Dashboard → Paiements → sélectionne la transaction → 'Télécharger'. PDF dispo pour ta compta ! 🧾"},
  {k: ["remboursement", "refund", "rembourse", "devolucion", "rimborso", "recuperer argent"], r: "Remboursements selon les conditions du contrat. Annulation venue ou no-show DJ = remboursement auto. Délai : 5-10 jours ouvrés. 💸"},
  {k: ["acompte", "deposit", "deposito", "anticipo", "avance"], r: "L'acompte (50% du cachet) est payé à la signature du contrat. Il sécurise la réservation. Le solde est versé après validation de la prestation. 💰"},

  // ═══════════════════════════════════════════════════════════════
  // SÉCURITÉ & VÉRIFICATION
  // ═══════════════════════════════════════════════════════════════
  {k: ["securite", "security", "donnees", "data", "privacy", "vie privee", "rgpd", "gdpr", "seguridad", "sicurezza", "protege"], r: "Tes données sont en sécurité ! 🔒 Chiffrement SSL, respect du RGPD, pas de partage sans accord. Les données de paiement sont gérées par Stripe (pas stockées chez nous)."},
  {k: ["verification", "verifier", "verify", "kyc", "identite", "identity", "verificacion", "verifica"], r: "La vérification d'identité protège tout le monde ! ✅ Garantit que les DJs sont réels. ✅ Sécurise les paiements. ✅ Renforce la confiance. C'est rapide et confidentiel."},
  {k: ["verification temps", "how long verification", "cuanto tarda verificacion", "quanto tempo verifica", "duree verification"], r: "La vérification prend généralement quelques minutes (auto). Parfois jusqu'à 24-48h si vérification manuelle. On te notifie dès que c'est fait ! ⏳"},
  {k: ["verification refusee", "verification failed", "documents refuses", "verificacion rechazada", "verifica rifiutata"], r: "Vérification refusée ? Vérifie : 📸 Photo nette. 📄 Document valide (non expiré). 🔍 Infos correspondent au profil. Réessaie ou contacte-nous !"},
  {k: ["signaler", "report", "probleme", "abus", "comportement suspect", "reportar", "segnalare"], r: "Pour signaler : va sur le profil/booking → 'Signaler' 🚩 → décris le problème. Notre équipe examine sous 24h. On prend ça très au sérieux ! 🛡️"},

  // ═══════════════════════════════════════════════════════════════
  // AVIS & RÉPUTATION
  // ═══════════════════════════════════════════════════════════════
  {k: ["avis", "review", "reviews", "notation", "rating", "opinion", "recensione", "resena", "etoiles", "stars"], r: "Après chaque booking validé, DJ et Venue se notent (1-5 étoiles + commentaire). Seuls les avis de vrais bookings comptent. Ça construit ta réputation ! ⭐"},
  {k: ["bons avis", "good reviews", "ameliorer avis", "mejores opiniones", "migliori recensioni", "plus etoiles"], r: "Pour de bons avis : 🎵 Super prestation. ⏰ Ponctualité. 💬 Bonne communication. 🎧 Respect du brief. 😊 Pro et sympa. Les bons avis viennent naturellement ! ⭐"},
  {k: ["supprimer avis", "delete review", "effacer avis", "eliminar opinion", "eliminare recensione", "mauvais avis"], r: "Les avis ne peuvent pas être supprimés (sauf insultes/fausses infos). Tu peux répondre publiquement pour donner ta version. Transparence ! 📝"},

  // ═══════════════════════════════════════════════════════════════
  // TYPES D'ÉVÉNEMENTS
  // ═══════════════════════════════════════════════════════════════
  {k: ["mariage", "wedding", "boda", "matrimonio", "casamento", "dj mariage"], r: "CUE est parfait pour les mariages ! 💒 Trouve un DJ qui correspond à ton style, génère un contrat pro, paiement sécurisé. Ton jour J sera parfait musicalement ! 🎵💍"},
  {k: ["club", "nightclub", "boite", "discoteca", "discothèque", "dj club"], r: "Pour les clubs, CUE propose des DJs vérifiés avec expérience en club. Matching par style musical, avis vérifiés, contrats pro. La nuit va être folle ! 🌙🎧"},
  {k: ["festival", "fest", "festval", "open air"], r: "Besoin d'un DJ pour ton festival ? CUE a des profils expérimentés pour les gros events. Matching précis, contrats adaptés, paiements sécurisés. 🎪🎵"},
  {k: ["anniversaire", "birthday", "cumpleanos", "compleanno", "aniversario", "fete"], r: "Un DJ pour ton anniversaire ? CUE te trouve le profil parfait selon ton ambiance et budget. Fais de ta fête un moment inoubliable ! 🎂🎉"},
  {k: ["corporate", "entreprise", "soiree entreprise", "evento corporativo", "evento aziendale", "business event"], r: "Pour les événements corporate, CUE propose des DJs pros et adaptables. Ambiance lounge, soirée de gala, team building... On a ce qu'il faut ! 🏢🎵"},
  {k: ["bar mitzvah", "bat mitzvah", "communion", "bapteme", "ceremonie"], r: "CUE couvre aussi les événements religieux et cérémonies ! Trouve un DJ respectueux qui saura créer l'ambiance parfaite. 🎵✨"},

  // ═══════════════════════════════════════════════════════════════
  // GENRES MUSICAUX
  // ═══════════════════════════════════════════════════════════════
  {k: ["house", "tech house", "deep house", "house music", "musica house"], r: "Tu cherches un DJ House ? 🏠 CUE a plein de profils spécialisés : Deep House, Tech House, Progressive... Utilise le matching pour trouver le style exact ! 🎵"},
  {k: ["techno", "minimal", "techno music", "dj techno", "musica techno"], r: "Besoin d'un DJ Techno ? 🔊 On a des spécialistes du genre : Minimal, Industrial, Melodic Techno... Le matching IA te trouve le bon ! 🎧"},
  {k: ["hip hop", "hiphop", "rap", "rnb", "r&b", "urban"], r: "DJ Hip-Hop/R&B ? 🎤 CUE a des pros du genre ! Que ce soit old school, trap, ou hits actuels, trouve ton DJ parfait ! 🔥"},
  {k: ["electro", "edm", "electronic", "electronica", "dance music"], r: "DJ Electro/EDM recherché ? ⚡ On a des profils pour tous les sous-genres : Progressive, Dubstep, Drum & Bass... À toi de matcher ! 🎵"},
  {k: ["disco", "funk", "nu disco", "funky", "groove"], r: "Ambiance Disco/Funk ? 🕺 CUE a des DJs qui font groover ! Nu-Disco, Funk, Soul... La piste sera pleine ! 💃"},
  {k: ["latin", "reggaeton", "salsa", "bachata", "latino"], r: "DJ Latin/Reggaeton ? 💃 CUE a des spécialistes : Reggaeton, Salsa, Bachata, Cumbia... L'ambiance latine garantie ! 🔥"},
  {k: ["pop", "hits", "commercial", "mainstream", "top 50", "charts"], r: "DJ Pop/Commercial ? 🎵 Parfait pour les mariages et fêtes ! On a des DJs qui mixent tous les hits actuels. Tout le monde dansera ! 🎉"},
  {k: ["rock", "indie", "alternative", "rock n roll"], r: "DJ Rock/Indie ? 🎸 Oui, on en a ! Pour des soirées alternative, indie, ou rock'n'roll. C'est plus rare mais on trouve ! 🤘"},

  // ═══════════════════════════════════════════════════════════════
  // SUPPORT & CONTACT
  // ═══════════════════════════════════════════════════════════════
  {k: ["contact", "aide", "help", "support", "ayuda", "aiuto", "email", "joindre", "assistance"], r: "Contacte-nous : 📧 cue.dj.app@gmail.com ou ce chat ! On répond sous 24h. Tu peux aussi nous suivre @cuedjapp 🙋"},
  {k: ["bug", "erreur", "error", "marche pas", "doesn't work", "no funciona", "non funziona", "probleme technique"], r: "Un bug ? 🐛 Décris-le précisément ici ou envoie un email à cue.dj.app@gmail.com avec des screenshots. On règle ça vite !"},
  {k: ["suggestion", "idee", "feature request", "amelioration", "sugerencia", "suggerimento"], r: "Une idée pour améliorer CUE ? On adore les suggestions ! Envoie-nous ça à cue.dj.app@gmail.com. On lit tout ! 💡"},
  {k: ["partenariat", "partnership", "collaboration", "colaboracion", "collaborazione", "sponsor"], r: "Intéressé par un partenariat ? Cool ! Contacte-nous à cue.dj.app@gmail.com avec ta proposition. On est ouverts ! 🤝"},

  // ═══════════════════════════════════════════════════════════════
  // QUESTIONS DIVERSES
  // ═══════════════════════════════════════════════════════════════
  {k: ["application", "app", "mobile", "ios", "android", "smartphone", "telefono", "aplicacion"], r: "Pour l'instant CUE est disponible en version web, optimisée mobile. Une app native iOS/Android arrive bientôt ! Stay tuned 📱🔜"},
  {k: ["pays", "country", "disponible ou", "donde disponible", "dove disponibile", "international", "france"], r: "CUE est disponible partout dans le monde ! 🌍 On a commencé en France mais on s'étend rapidement. DJs et Venues de tous pays sont les bienvenus !"},
  {k: ["langue", "language", "idioma", "lingua", "english", "espanol", "italiano", "francais"], r: "L'interface CUE est en anglais/français pour l'instant. D'autres langues arrivent bientôt ! Le chat ici comprend plusieurs langues 🌍"},
  {k: ["urgent", "vite", "rapide", "quick", "fast", "urgente", "asap"], r: "Besoin urgent ? 🚨 Pour les urgences, écris à cue.dj.app@gmail.com avec 'URGENT' en objet. On fait au plus vite !"},
  {k: ["ca ne marche pas", "rien ne marche", "tout est casse", "nothing works", "nada funciona"], r: "Ça ne marche pas ? 😰 Essaie : 1) Rafraîchir la page 2) Vider le cache 3) Autre navigateur. Toujours KO ? Contacte cue.dj.app@gmail.com avec les détails !"}
];

function searchFaq(msg) {
  const cleanMsg = msg.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const words = cleanMsg.split(/\s+/).filter(w => w.length > 1);
  
  let best = null;
  let bestScore = 0;
  
  for (const item of FAQ_DATA) {
    let score = 0;
    for (const word of words) {
      for (const k of item.k) {
        const cleanK = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (word === cleanK) score += 25;
        else if (word.includes(cleanK) || cleanK.includes(word)) score += 15;
        else if (word.length > 3 && cleanK.length > 3) {
          let matches = 0;
          for (let i = 0; i < Math.min(word.length, cleanK.length); i++) {
            if (word[i] === cleanK[i]) matches++;
          }
          if (matches >= word.length * 0.7) score += 10;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 10 ? best : null;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return {statusCode: 200, headers, body: ""};
  }

  try {
    const body = JSON.parse(event.body);
    const message = body.message || "";
    const match = searchFaq(message);
    
    if (match) {
      return {statusCode: 200, headers, body: JSON.stringify({reply: match.r})};
    }
    return {statusCode: 200, headers, body: JSON.stringify({reply: "Hmm, je n'ai pas compris ta question 🤔 Essaie de reformuler ou contacte-nous : cue.dj.app@gmail.com 📧"})};
  } catch (e) {
    return {statusCode: 200, headers, body: JSON.stringify({reply: "Oops, petite erreur ! Réessaie ou contacte : cue.dj.app@gmail.com 📧"})};
  }
};
