exports.handler = async (event) => {
  const headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json"};
  if (event.httpMethod === "OPTIONS") return {statusCode: 200, headers, body: ""};
  
  try {
    const {type, vibe, budget, city} = JSON.parse(event.body);
    
    const djs = [
      {name: "DJ Luna", match: 95, tags: ["House", "Tech House", "Deep House"], price: budget === "less300" ? "250" : budget === "300-600" ? "450" : "750", bio: "Spécialisée en " + (type || "événements") + ", DJ Luna apporte une énergie unique. Résidente dans plusieurs clubs parisiens, elle maîtrise l'art de faire monter l'ambiance progressivement. " + (city ? "Disponible sur " + city + "." : "")},
      {name: "Marco Beats", match: 88, tags: ["Techno", "Minimal", "Electronic"], price: budget === "less300" ? "280" : budget === "300-600" ? "500" : "850", bio: "10 ans d'expérience en clubs et festivals. Style énergique adapté aux ambiances " + (vibe || "festives") + ". Matériel pro fourni."},
      {name: "Sarah Groove", match: 82, tags: ["Disco", "Funk", "Nu-Disco"], price: budget === "less300" ? "200" : budget === "300-600" ? "400" : "650", bio: "Sets funky et dansants, parfaits pour " + (type || "soirées privées") + ". Fait lever tout le monde sur la piste !"},
      {name: "Alex Vega", match: 78, tags: ["Hip-Hop", "R&B", "Urban"], price: budget === "less300" ? "220" : budget === "300-600" ? "420" : "700", bio: "Expert en ambiances urbaines. Mix les derniers hits avec les classiques. Idéal pour un public jeune et dynamique."},
      {name: "Nina Electric", match: 75, tags: ["EDM", "Progressive", "Big Room"], price: budget === "less300" ? "300" : budget === "300-600" ? "550" : "900", bio: "Productions originales et sets explosifs. Parfaite pour les grands événements et festivals."}
    ];
    
    return {statusCode: 200, headers, body: JSON.stringify({djs: djs.slice(0, 3)})};
  } catch (e) {
    return {statusCode: 500, headers, body: JSON.stringify({detail: e.message})};
  }
};
