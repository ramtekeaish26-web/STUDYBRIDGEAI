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

## Hackathon Vision & Problem‑Statement Alignment

The **StudyBridge** hackathon brief asks for *"an engaging platform where students can learn, experiment, collaborate, and build meaningful solutions using AI"*.  The current codebase directly addresses each of these goals:

| Hackathon Requirement | How StudyBridge fulfills it |
|-----------------------|------------------------------|
| **Learn** – personalized explanations and multi‑turn tutoring | **Concept Simplifier** (src/components/ConceptSimplifierView.tsx) parses uploaded notes, uses Gemini to generate tiered explanations, and exports an offline PDF.  **Study Tutor** (src/components/StudyTutorView.tsx) provides a Gemini‑driven conversational coach with selectable personas. |
| **Experiment** – interactive what‑if scenarios | **Experiment Lab** (src/components/ExperimentLabView.tsx) lets users adjust assumption sliders, runs the deterministic `computeSimulatedChartSeries` math, and optionally asks Gemini for interpretation of the results. |
| **Collaborate** – real‑time shared workspaces | **Solution Studio & Study Rooms** (src/components/SolutionStudioView.tsx, src/components/Sidebar.tsx) use Firestore rules to synchronize rooms, task checklists, and AI‑generated solution blueprints among multiple users. |
| **Build solutions** – AI‑assisted project creation | **Solution Studio** guides users from concept to prototype, calling Gemini for design suggestions, feasibility scoring, and iteration. |
| **AI‑first experience** – Gemini integration throughout | Gemini is invoked in **Concept Simplifier**, **Study Tutor**, and **Solution Studio** via the server‑side API (`src/utils/apiClient.ts`).  All AI calls are protected by the existing security rules and never expose the API key to the client. |

## Component‑to‑Feature Mapping

| Feature | Primary UI Component(s) |
|--------|--------------------------|
| Dashboard | `src/components/DashboardView.tsx` |
| Concept Simplifier | `src/components/ConceptSimplifierView.tsx` |
| Quiz Arena | `src/components/QuizArenaView.tsx` |
| Learning Gap Detector | `src/components/LearningGapDetectorView.tsx` |
| Experiment Lab | `src/components/ExperimentLabView.tsx` |
| Solution Studio & Study Rooms | `src/components/SolutionStudioView.tsx`, `src/components/Sidebar.tsx` |
| Study Tutor | `src/components/StudyTutorView.tsx` |
| Global Focus Timer & Settings | `src/components/FocusTimerWidget.tsx`, `src/components/SettingsView.tsx` |

## Gemini AI Integration Details

* **Concept Simplifier** – Sends the uploaded note text plus the selected difficulty level to Gemini (`/api/tutor` endpoint).  The response is displayed in the UI and also saved as a PDF for offline study.
* **Study Tutor** – Implements a multi‑turn chat flow.  Each user turn is sent to Gemini with optional Google Search grounding; the response includes citations that are filtered through `sanitizeCitations` for safety.
* **Solution Studio** – Generates solution blueprints, feasibility scores, and critique iterations.  Users can request re‑simulation of assumptions; Gemini explains the impact and suggests next steps.

All Gemini calls are performed server‑side (`src/utils/api.ts` → `src/utils/apiClient.ts`) so the secret key lives only in the `.env` file and is never shipped to the browser.

## How Judges Can Explore the Application

1. **Clone & install** – Follow the existing instructions (npm install, copy `.env.example` → `.env`).  Use any dummy value for `GEMINI_API_KEY` if you only want to run the UI; the core UI works offline and the PDF export does not require live AI.
2. **Run the dev server** – `npm run dev` starts the Express + Vite stack on `http://localhost:3000`.
3. **Navigate the six core screens** using the sidebar:
   * Dashboard → see live mastery stats.
   * Concept Simplifier → upload a small text file and generate a simplified lesson.
   * Quiz Arena → attempt a few auto‑generated questions.
   * Learning Gap Detector → view mastery classification.
   * Experiment Lab → move a slider and observe the simulated chart.
   * Study Tutor → start a brief chat with the AI.
4. **Optional AI demo** – If you provide a real Gemini API key, you can test the AI‑generated explanations and tutoring flows.
5. **Run the test suite** – `npm test` should complete in < 20 seconds with **0 failures**, confirming the reliability of the core logic.

These steps let judges verify that the application meets the hackathon’s vision without any hidden or undeclared functionality.
