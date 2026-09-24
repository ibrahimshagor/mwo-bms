var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "20mb" }));
  app.use(import_express.default.urlencoded({ limit: "20mb", extended: true }));
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  app.get("/mwo-logo.png", (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(import_path.default.join(process.cwd(), "mwo-logo.svg"));
  });
  app.get("/mwo-favicon.png", (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(import_path.default.join(process.cwd(), "mwo-favicon.svg"));
  });
  app.get("/favicon.ico", (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(import_path.default.join(process.cwd(), "mwo-favicon.svg"));
  });
  const modelsStaticOptions = {
    maxAge: "7d",
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    }
  };
  const modelsDir = import_path.default.join(process.cwd(), "public", "models");
  app.use("/models", import_express.default.static(modelsDir, modelsStaticOptions));
  app.use("/mwobms/models", import_express.default.static(modelsDir, modelsStaticOptions));
  app.post("/api/face-match", async (req, res) => {
    try {
      if (!apiKey) {
        console.warn("GEMINI_API_KEY environment variable is not defined on the server.");
        return res.status(200).json({
          match: false,
          matchedId: null,
          confidence: 0,
          reasoning: "Face match scanning configuration is incomplete because the GEMINI_API_KEY is missing on the server. Please define GEMINI_API_KEY in Settings."
        });
      }
      const { capturedPhoto, candidates } = req.body;
      if (!capturedPhoto) {
        return res.status(400).json({ error: "Missing biometric captured frame (capturedPhoto)." });
      }
      if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        return res.status(200).json({
          match: false,
          matchedId: null,
          confidence: 0,
          reasoning: "There are currently no registered beneficiaries with photos stored in the database to cross-reference."
        });
      }
      const parseDataUrl = (dataUrl) => {
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          return { mimeType: match[1], data: match[2] };
        }
        return { mimeType: "image/jpeg", data: dataUrl };
      };
      const parts = [];
      try {
        const capturedParsed = parseDataUrl(capturedPhoto);
        parts.push({
          inlineData: {
            mimeType: capturedParsed.mimeType,
            data: capturedParsed.data
          }
        });
      } catch (err) {
        return res.status(400).json({ error: "Invalid live scanned camera frame encoding." });
      }
      parts.push({
        text: "Above is the live camera snapshot captured from the biometric terminal. Carefully evaluate the facial geometries, facial landmarks, eye shape/spacing, cheekbones, nose, and jawline against the Candidate Profile photo segments registered below to see if they are the exact same individual."
      });
      let validCandidatesCount = 0;
      for (const cand of candidates) {
        if (!cand.photo) continue;
        try {
          const parsed = parseDataUrl(cand.photo);
          if (parsed.data && parsed.data.length > 100) {
            parts.push({
              text: `Candidate Database Record:
ID: ${cand.id}
Name: ${cand.name}`
            });
            parts.push({
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.data
              }
            });
            validCandidatesCount++;
          }
        } catch (err) {
          console.error(`Skipping invalid profile photo for candidate ${cand.id}:`, err);
        }
      }
      if (validCandidatesCount === 0) {
        return res.status(200).json({
          match: false,
          matchedId: null,
          confidence: 0,
          reasoning: "No registered beneficiaries have actual camera portraits saved yet (most use default blank silhouettes). Register a new profile or edit an existing beneficiary to snap an actual photo first."
        });
      }
      parts.push({
        text: `Based on your high precision facial matching expertise, answer whether the live biometric scanned person is the exact same individual as any of the Candidate profiles.
Differences in camera resolution, lighting, smile/expression, or slight angles should be accounted for, but matching different people must result in strict verification failure.

Provide your face-recognition match outcome. Format the output strictly as a JSON object matching this schema:
{
  "match": boolean (true if highly confident biometric match, false otherwise),
  "matchedId": string | null (the ID of the correctly matched candidate if match is true, otherwise null),
  "confidence": number (matching likelihood score from 0.0 to 100.0, where >= 85.0 verifies positive match),
  "reasoning": string (very short explanation: e.g. 'Highly identical eye structure, nose projection, and upper facial geometry matching Abul Kamal' or 'Distinctly different eye spacing and jaw width than Fatema Begum')
}`
      });
      let response;
      let lastErr;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: parts,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: import_genai.Type.OBJECT,
                properties: {
                  match: { type: import_genai.Type.BOOLEAN },
                  matchedId: { type: import_genai.Type.STRING },
                  confidence: { type: import_genai.Type.NUMBER },
                  reasoning: { type: import_genai.Type.STRING }
                },
                required: ["match", "matchedId", "confidence", "reasoning"]
              }
            }
          });
          break;
        } catch (err) {
          lastErr = err;
          const errStr = String(err);
          const isRetryable = errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED");
          if (isRetryable && attempt < maxAttempts) {
            const delayMs = attempt * 1e3;
            console.warn(`Gemini 3.5 Flash is experiencing high demand (Attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms... Error detail:`, errStr);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            throw err;
          }
        }
      }
      if (!response) {
        throw lastErr || new Error("Failed to communicate with Gemini API.");
      }
      const responseText = response.text;
      if (!responseText) {
        throw new Error("Facial scanning analysis returned empty content.");
      }
      let cleanText = responseText.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }
      const matchResult = JSON.parse(cleanText.trim());
      console.log("Gemini Biometric Verification Results:", matchResult);
      return res.status(200).json(matchResult);
    } catch (err) {
      console.error("Biometric match failure:", err);
      return res.status(200).json({
        match: false,
        matchedId: null,
        confidence: 0,
        reasoning: `Facial verification engine threw an exception: ${err.message || err}`
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
