// app/api/generate-questions/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@clerk/nextjs/server";

const CATEGORY_PROMPTS = {
  FRONTEND: "React, JavaScript, CSS, performance, accessibility, browser APIs",
  BACKEND:
    "Node.js, REST APIs, databases, authentication, caching, scalability",
  FULLSTACK:
    "full-stack architecture, API design, state management, deployment",
  DSA: "data structures, algorithms, time complexity, problem solving",
  SYSTEM_DESIGN:
    "distributed systems, scalability, databases, microservices, caching",
  BEHAVIORAL:
    "leadership, teamwork, conflict resolution, career growth, STAR method",
  DEVOPS: "CI/CD, Docker, Kubernetes, cloud infrastructure, monitoring",
  MOBILE:
    "React Native, iOS/Android, performance, offline support, app lifecycle",
};

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category } = await request.json();
  if (!category || !CATEGORY_PROMPTS[category]) {
    return Response.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `You are an expert technical interviewer. Generate 6 interview questions for a ${category} role covering: ${CATEGORY_PROMPTS[category]}.

For each question, provide a concise but complete answer (2-4 sentences) that an interviewer can use to evaluate responses.

Respond ONLY with a valid JSON array. No markdown, no backticks, no explanation. Example format:
[{"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip any accidental markdown fences
    const clean = text.replace(/^```json|^```|```$/gm, "").trim();
    const questions = JSON.parse(clean);

    return Response.json({ questions });
  } catch (err) {
    console.error("Gemini error:", err);
    return Response.json(
      { error: "Failed to generate questions. Please try again." },
      { status: 500 }
    );
  }
}
