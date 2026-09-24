import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure larger payload limits for Base64 biometric photographs
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Initialize server-side Gemini SDK client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Serve the beautiful brand logo as an on-the-fly intercepted SVG-as-image
  app.get("/mwo-logo.png", (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(path.join(process.cwd(), "mwo-logo.svg"));
  });

  app.get("/mwo-favicon.png", (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(path.join(process.cwd(), "mwo-favicon.svg"));
  });

  app.get("/favicon.ico", (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.sendFile(path.join(process.cwd(), "mwo-favicon.svg"));
  });

  // Serve face-api.js neural network weights locally from public/models with cross-origin & caching headers
  const modelsStaticOptions = {
    maxAge: "7d",
    setHeaders: (res: express.Response) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  };
  const modelsDir = path.join(process.cwd(), "public", "models");
  app.use("/models", express.static(modelsDir, modelsStaticOptions));
  app.use("/mwobms/models", express.static(modelsDir, modelsStaticOptions));

  // Real facial biometric matching endpoint
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

      // Dynamic parser for Data URL schema
      const parseDataUrl = (dataUrl: string) => {
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          return { mimeType: match[1], data: match[2] };
        }
        return { mimeType: "image/jpeg", data: dataUrl };
      };

      const parts: any[] = [];

      try {
        const capturedParsed = parseDataUrl(capturedPhoto);
        parts.push({
          inlineData: {
            mimeType: capturedParsed.mimeType,
            data: capturedParsed.data,
          },
        });
      } catch (err) {
        return res.status(400).json({ error: "Invalid live scanned camera frame encoding." });
      }

      parts.push({
        text: "Above is the live camera snapshot captured from the biometric terminal. Carefully evaluate the facial geometries, facial landmarks, eye shape/spacing, cheekbones, nose, and jawline against the Candidate Profile photo segments registered below to see if they are the exact same individual.",
      });

      let validCandidatesCount = 0;
      for (const cand of candidates) {
        if (!cand.photo) continue;
        try {
          const parsed = parseDataUrl(cand.photo);
          // Only process actual base64 photos
          if (parsed.data && parsed.data.length > 100) {
            parts.push({
              text: `Candidate Database Record:\nID: ${cand.id}\nName: ${cand.name}`
            });
            parts.push({
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.data,
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
}`,
      });

      // Query Gemini 3.5 Flash Multimodal model with resilient retries for temporary spikes/503 errors
      let response;
      let lastErr: any;
      const maxAttempts = 3;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: parts,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  match: { type: Type.BOOLEAN },
                  matchedId: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING },
                },
                required: ["match", "matchedId", "confidence", "reasoning"],
              },
            },
          });
          break; // successfully received a response, break retry loop
        } catch (err: any) {
          lastErr = err;
          const errStr = String(err);
          const isRetryable = errStr.includes("503") || 
                              errStr.includes("UNAVAILABLE") || 
                              errStr.includes("429") || 
                              errStr.includes("RESOURCE_EXHAUSTED");
                              
          if (isRetryable && attempt < maxAttempts) {
            const delayMs = attempt * 1000; // 1000ms, then 2000ms
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

    } catch (err: any) {
      console.error("Biometric match failure:", err);
      return res.status(200).json({
        match: false,
        matchedId: null,
        confidence: 0,
        reasoning: `Facial verification engine threw an exception: ${err.message || err}`
      });
    }
  });

  // Serve static assets or mount Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched on port ${PORT}`);
  });
}

startServer();
