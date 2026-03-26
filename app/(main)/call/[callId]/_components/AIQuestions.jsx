"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/data";

export default function AIQuestionsPanel({ categories }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    categories?.[0] ?? null
  );

  const generateQuestions = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory }),
      });
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error("Failed to generate questions:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Category selector */}
      <div className="flex flex-wrap gap-1.5">
        {categories?.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              selectedCategory === cat
                ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                : "border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-400"
            }`}
          >
            {CATEGORY_LABEL[cat] ?? cat}
          </button>
        ))}
      </div>

      <Button
        variant="gold"
        size="sm"
        disabled={loading || !selectedCategory}
        onClick={generateQuestions}
        className="self-start gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles size={13} />
            Generate questions
          </>
        )}
      </Button>

      {/* Questions list */}
      {questions.length > 0 ? (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
          {questions.map((q, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/8 bg-[#141417] p-4 flex flex-col gap-2"
            >
              <p className="text-sm text-stone-200 font-medium leading-snug">
                {i + 1}. {q.question}
              </p>
              <div className="h-px bg-white/5" />
              <p className="text-xs text-stone-500 font-light leading-relaxed">
                <span className="text-amber-400/70 font-medium">Answer: </span>
                {q.answer}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <span className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <Sparkles size={16} className="text-amber-400" />
          </span>
          <p className="text-xs text-stone-600">
            Select a category and generate role-specific questions for this
            session.
          </p>
        </div>
      )}
    </div>
  );
}
