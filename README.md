# STUDYBRIDGE

> **Learn smarter. Understand deeper. Grow faster.**

STUDYBRIDGE is an AI-powered educational platform that helps students simplify complex concepts, test recall in an interactive quiz arena, detect topic-level learning gaps, and run interactive what-if experiments.

## Features

1. **Dashboard** — Personalized welcome, live mastery statistics, 7-day study activity chart, Continue Learning priority card, recent topics, and dynamic revision recommendations.
2. **Concept Simplifier** — Topic input, PDF/Markdown/TXT study-notes upload, Beginner/Intermediate/Advanced level selector, multi-language output, and structured lessons (definition, step-by-step mechanism, real-world examples, analogies, key takeaways).
3. **Quiz Arena** — Pre-loaded study banks and live AI-generated 4-option multiple-choice quizzes with question navigation, instant explanations, score summary, and automatic progress syncing.
4. **Learning Gap Detector** — Calculates topic mastery (`correct / attempted * 100`), classifies understanding (`Needs Improvement`, `Developing`, `Good Understanding`, `Strong Understanding`, or `Insufficient Data`), tracks previous vs. latest attempt deltas, and offers direct Retake Quiz / Review Lesson actions.
5. **Experiment Lab** — Interactive "What-If" scenario explorer with live adjustable assumption sliders, baseline vs. simulated impact visualization, outcome explanations, and real-world applications.
6. **Settings** — Customize learner profile, default level/language, weekly quiz target, export progress JSON, or reset to initial sample data.

## Setup & Running Locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and add your Gemini API key (`GEMINI_API_KEY`) on the server side to enable live AI generation in Concept Simplifier, Quiz Arena, and Experiment Lab.

3. **Start the development server**
   ```bash
   npm run dev
   ```
   The full-stack Express + Vite server runs on `http://localhost:3000`.

4. **Type-check and build for production**
   ```bash
   npm run lint
   npm run build
   npm start
   ```
