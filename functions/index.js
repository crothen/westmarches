import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");

initializeApp();
const db = getFirestore();

// Bot webhook URL (set in Firebase environment config)
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

// Helper to call the bot webhook
async function notifyBot(event, data) {
  if (!BOT_WEBHOOK_URL) {
    console.warn("BOT_WEBHOOK_URL not configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(BOT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
    });

    if (!response.ok) {
      console.error(`Bot webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error("Failed to notify bot:", err);
  }
}

// Helper to get user's Discord ID from Firestore
async function getDiscordId(userId) {
  if (!userId) return null;
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    return userDoc.exists ? userDoc.data()?.discordId : null;
  } catch {
    return null;
  }
}

// Trigger: New scheduled session created
export const onScheduledSessionCreated = onDocumentCreated(
  "scheduledSessions/{sessionId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const sessionDate = data.date?.toDate?.() || new Date(data.date);
    const formattedDate = sessionDate.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await notifyBot("session_created", {
      sessionId: event.params.sessionId,
      title: data.title || "Game Session",
      date: formattedDate,
      location: data.sessionLocationLabel || null,
      maxPlayers: data.maxPlayers || null,
      description: data.description || null,
    });
  }
);

// Trigger: Scheduled session updated (check for signup changes)
export const onScheduledSessionUpdated = onDocumentUpdated(
  "scheduledSessions/{sessionId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const beforeSignups = before.signups || [];
    const afterSignups = after.signups || [];

    // Find new signups
    const beforeUserIds = new Set(beforeSignups.map((s) => s.userId));
    const newSignups = afterSignups.filter((s) => !beforeUserIds.has(s.userId));

    // Find withdrawals
    const afterUserIds = new Set(afterSignups.map((s) => s.userId));
    const withdrawals = beforeSignups.filter((s) => !afterUserIds.has(s.userId));

    const sessionDate = after.date?.toDate?.() || new Date(after.date);
    const formattedDate = sessionDate.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    // Notify for each new signup
    for (const signup of newSignups) {
      const discordId = await getDiscordId(signup.userId);
      await notifyBot("player_signup", {
        sessionId: event.params.sessionId,
        sessionTitle: after.title || "Game Session",
        sessionDate: formattedDate,
        playerName: signup.characterName,
        playerDiscordId: discordId,
        currentSignups: afterSignups.length,
        maxPlayers: after.maxPlayers || null,
      });
    }

    // Notify for withdrawals
    for (const withdrawal of withdrawals) {
      const discordId = await getDiscordId(withdrawal.userId);
      await notifyBot("player_withdrawal", {
        sessionId: event.params.sessionId,
        sessionTitle: after.title || "Game Session",
        sessionDate: formattedDate,
        playerName: withdrawal.characterName,
        playerDiscordId: discordId,
        currentSignups: afterSignups.length,
        maxPlayers: after.maxPlayers || null,
      });
    }
  }
);

// Image generation via Gemini
export const generateImage = onCall(
  { 
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    memory: "512MiB",
    invoker: "public",  // Allow Firebase SDK to invoke (auth handled at app level)
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in to generate images");
    }

    const { prompt, model = "gemini-2.0-flash-exp-image-generation" } = request.data;

    if (!prompt || typeof prompt !== "string") {
      throw new HttpsError("invalid-argument", "Prompt is required");
    }

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const imageModel = genAI.getGenerativeModel({
        model,
        generationConfig: { responseModalities: ["Text", "Image"] },
      });

      const result = await imageModel.generateContent(prompt);
      const response = result.response;

      // Extract image from response
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return {
            success: true,
            image: {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data,
            },
          };
        }
      }

      // No image in response
      const textParts = response.candidates?.[0]?.content?.parts?.filter(p => p.text) || [];
      const textResponse = textParts.map(p => p.text).join("\n");
      
      throw new HttpsError("internal", textResponse || "No image generated");
    } catch (err) {
      console.error("Image generation failed:", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Image generation failed");
    }
  }
);
