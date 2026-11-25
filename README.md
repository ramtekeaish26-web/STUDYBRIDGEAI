# STUDYBRIDGE

> **Learn smarter. Understand deeper. Grow faster.**

STUDYBRIDGE is an AI-powered educational platform where students learn through personalized explanations, test recall and detect learning gaps, explore interactive what-if experiments, collaborate in live Study Rooms, and build meaningful real-world solutions using AI.

## Features

1. **Dashboard** — Personalized welcome, live mastery statistics, 7-day study activity chart, Continue Learning priority card, recent topics, and dynamic revision recommendations.
2. **Concept Simplifier** — Topic input, validated PDF/Markdown/TXT study-notes upload, Beginner/Intermediate/Advanced level selector, multi-language output, Google Search grounding, structured lessons, and offline PDF export.
3. **Quiz Arena** — Pre-loaded study banks and live AI-generated 4-option multiple-choice quizzes with question navigation, instant explanations, score summary, and automatic progress syncing.
4. **Learning Gap Detector** — Calculates topic mastery (`correct / attempted * 100`), classifies understanding (`Needs Improvement`, `Developing`, `Good Understanding`, `Strong Understanding`, or `Insufficient Data`), tracks previous vs. latest attempt deltas, and links directly to Review Lesson, Retake Quiz, and Build Solution.
5. **Experiment Lab** — Interactive "What-If" scenario explorer with adjustable assumption sliders, baseline vs. simulated impact visualization, AI slider re-simulation, outcome explanations, and real-world applications.
6. **Solution Studio & Study Rooms** — AI-assisted real-world solution blueprint builder linked to concepts, weak topics, and experiments, with collaborative task checklists, feasibility scoring, AI critique iteration, room-code sharing, and real-time Firestore Study Rooms (when signed in with Google).
7. **Study Tutor** — Multi-turn Gemini coaching with selectable tutor personas, reasoning model tiers, and Google Search grounding citations.
8. **Global Focus Timer & Settings** — Persistent sidebar study timer with auto-logging, learner preferences, JSON progress export, and Firebase Google Sign-In cloud sync.

## Setup & Running Locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and add your Gemini API key (`GEMINI_API_KEY`) on the server side to enable live AI generation across all endpoints.

3. **Run automated unit & integration tests**
   ```bash
   npm test
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The full-stack Express + Vite server runs on `http://localhost:3000`.

5. **Type-check and build for production**
   ```bash
   npm run lint
   npm run build
   npm start
   ```
