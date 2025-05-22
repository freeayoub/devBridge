const fs = require("fs/promises");
const path = require("path");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
//const fetch = require("node-fetch"); // Assure-toi que node-fetch est installé
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


// CONFIGURATION DE L'IA LOCALE
const LOCAL_AI_URL = "http://127.0.0.1:1234/v1/chat/completions"; // Utiliser l'adresse IP au lieu de localhost
const USE_FALLBACK = process.env.USE_AI_FALLBACK === "true" || false;
const USE_OPENAI = process.env.USE_OPENAI === "true" || false;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Fonction pour appeler OpenAI
const callOpenAI = async (prompt) => {
  if (!OPENAI_API_KEY) {
    console.error("❌ Clé API OpenAI manquante");
    return getFallbackEvaluation("Clé API OpenAI manquante");
  }
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Tu es un assistant spécialisé dans l'évaluation de projets informatiques." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message || "Erreur OpenAI");
    }
    
    const text = result.choices[0].message.content.trim();

    if (text.startsWith("{") && text.endsWith("}")) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Erreur de parsing JSON:", e);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Format de réponse invalide");
      }
    } else {
      throw new Error("Réponse inattendue : " + text);
    }
  } catch (error) {
    console.error("❌ Erreur OpenAI:", error.message);
    return getFallbackEvaluation(error.message);
  }
};

// Fonction commune pour appeler l'IA
const callLocalModel = async (prompt) => {
  if (USE_FALLBACK) {
    console.log("Utilisation de l'évaluation de secours (configurée)");
    return getFallbackEvaluation();
  }
  
  if (USE_OPENAI) {
    console.log("Utilisation d'OpenAI pour l'évaluation");
    return await callOpenAI(prompt);
  }
  
  try {
    const response = await fetch(LOCAL_AI_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer not-needed" // Certaines implémentations locales requièrent un token fictif
      },
      body: JSON.stringify({
        model: "mathstral-7b-v0.1", // Nom du modèle Mistral
        messages: [
          { role: "system", content: "Tu es un assistant spécialisé dans l'évaluation de projets informatiques." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    const result = await response.json();
    const text = result.choices[0].message.content.trim();

    if (text.startsWith("{") && text.endsWith("}")) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Erreur de parsing JSON:", e);
        // Tentative de nettoyage du texte pour extraire le JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Format de réponse invalide");
      }
    } else {
      throw new Error("Réponse inattendue : " + text);
    }
  } catch (error) {
    console.error("❌ Erreur IA locale :", error.message);
    return getFallbackEvaluation(error.message);
  }
};

// Analyse de code (mise à jour pour Mistral)
const analyzeCode = async (code, language) => {
  const prompt = `Évalue ce code ${language} selon ces critères sur 20 points :
1. Structure et organisation (0-5)
2. Bonnes pratiques (0-5)
3. Fonctionnalité (0-5)
4. Originalité (0-5)

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "scores": {
    "structure": number,
    "pratiques": number,
    "fonctionnalite": number,
    "originalite": number
  },
  "commentaires": string
}

Code :      

${code.substring(0, 6000)}...`;

  return await callLocalModel(prompt);
};

// Analyse de document (mise à jour pour Mistral)
const analyzeDocumentContent = async (text) => {
  if (typeof text !== "string" || !text.trim()) {
    return {
      success: false,
      error: "Le contenu est vide ou invalide.",
    };
  }

  const prompt = `Analyse ce document selon :
1. Structure et organisation (0-5)
2. Bonnes pratiques (0-5)
3. Fonctionnalité (0-5)
4. Originalité (0-5)

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "scores": {
    "structure": number,
    "pratiques": number,
    "fonctionnalite": number,
    "originalite": number
  },
  "commentaires": string
}

Document :
${text.substring(0, 6000)}...`;

  try {
    const json = await callLocalModel(prompt);
    return {
      success: true,
      data: json,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Lecture de fichier (PDF, DOCX, TXT, etc.)
const readFileContent = async (filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = await fs.readFile(filePath);

    if (ext === ".pdf") {
      const data = await pdfParse(buffer);
      return data.text;
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else {
      return buffer.toString(); // .txt, .js, .py, etc.
    }
  } catch (error) {
    console.error("❌ Erreur lecture fichier :", error.message);
    throw error;
  }
};

// Évaluation d’un rendu (code ou document)
const evaluateRendu = async (reqBody) => {
  try {
    const { contenu } = reqBody;

    if (!contenu || contenu.trim() === "") {
      return { success: false, error: "Le contenu est vide." };
    }

    const evaluationResponse = await analyzeDocumentContent(contenu);

    if (!evaluationResponse || evaluationResponse.success === false) {
      return {
        success: false,
        error:
          evaluationResponse?.error ||
          "Erreur inconnue dans l'analyse du document.",
      };
    }

    return {
      success: true,
      data: evaluationResponse.data || evaluationResponse,
    };
  } catch (error) {
    console.error("❌ Erreur dans evaluateRendu :", error.message);
    return {
      success: false,
      error: error.message || "Erreur inconnue",
    };
  }
};

module.exports = {
  analyzeCode,
  analyzeDocumentContent,
  evaluateRendu,
  readFileContent,
};
