import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Compass,
  FlaskConical,
  Loader2,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { ExperimentParameter, ExperimentScenario } from '../types/study';

const EXAMPLE_QUESTIONS = [
  "What if Earth's surface gravity doubled from 9.8 m/s² to 19.6 m/s²?",
  'What if global ocean surface pH dropped from 8.1 to 7.6?',
  'What if central banks raise policy interest rates by 300 basis points?',
  'What if atmospheric CO2 doubled inside a closed botanical dome?',
];

export function ExperimentLabView() {
  const { experiments, addExperiment } = useStudy();
  const [selectedId, setSelectedId] = useState<string>(experiments[0]?.id ?? '');
  const [questionInput, setQuestionInput] = useState<string>('');
  const [paramOverrides, setParamOverrides] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeExperiment: ExperimentScenario | undefined =
    experiments.find((e) => e.id === selectedId) ?? experiments[0];

  const getParamValue = (p: ExperimentParameter): number =>
    paramOverrides[p.id] !== undefined ? paramOverrides[p.id] : p.value;

  // Dynamically scale chart values smoothly based on assumption slider deviation from baseline
  const dynamicChartSeries = useMemo(() => {
    if (!activeExperiment) return [];
    const params = activeExperiment.parameters;
    if (params.length === 0) return activeExperiment.chartSeries;

    const avgShiftFactor =
      params.reduce((acc, p) => {
        const current = getParamValue(p);
        const span = Math.max(p.max - p.min, 1);
        const deltaRatio = (current - p.value) / span;
        return acc + deltaRatio * p.sensitivity;
      }, 0) / params.length;

    return activeExperiment.chartSeries.map((pt, idx) => {
      const direction = idx % 2 === 0 ? 1 : -1;
      const adjusted = Math.max(
        5,
        Math.round(pt.simulated * (1 + avgShiftFactor * 0.65 * direction))
      );
      return {
        ...pt,
        simulated: adjusted,
      };
    });
  }, [activeExperiment, paramOverrides]);

  const handleSelectExperiment = (exp: ExperimentScenario) => {
    setSelectedId(exp.id);
    setParamOverrides({});
    setError(null);
  };

  const handleRunExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = questionInput.trim();
    if (!cleanQuestion) {
      setError('Enter a what-if question to run an experiment.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentAssumptions = activeExperiment
        ? activeExperiment.parameters.map((p) => ({
            label: p.label,
            value: getParamValue(p),
            unit: p.unit,
          }))
        : [];

      const res = await fetch('/api/experiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: cleanQuestion,
          assumptions: currentAssumptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run experiment.');
      }

      const exp = data.experiment;
      const created: ExperimentScenario = {
        id: `exp-${Date.now()}`,
        question: cleanQuestion,
        title: exp.title || cleanQuestion,
        domain: exp.domain || 'Interdisciplinary Systems',
        summary: exp.summary || '',
        predictions: Array.isArray(exp.predictions) ? exp.predictions : [],
        parameters: Array.isArray(exp.parameters) ? exp.parameters : [],
        outcomeExplanation: Array.isArray(exp.outcomeExplanation)
          ? exp.outcomeExplanation
          : [],
        realWorldApplications: Array.isArray(exp.realWorldApplications)
          ? exp.realWorldApplications
          : [],
        chartSeries: Array.isArray(exp.chartSeries) ? exp.chartSeries : [],
        isAiGenerated: true,
      };

      addExperiment(created);
      setSelectedId(created.id);
      setParamOverrides({});
      setQuestionInput('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate experiment right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  const maxChartVal = Math.max(
    100,
    ...dynamicChartSeries.flatMap((d) => [d.baseline, d.simulated])
  );

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold text-[#1e2436]">Experiment Lab</h1>
        <p className="mt-1 text-sm text-[#5a6378]">
          Ask "What-If" questions, adjust system assumptions in real time, and examine predicted outcomes.
        </p>
      </header>

      {/* What-If Prompt Input & Example Experiments */}
      <section className="neu-raised p-6 space-y-5">
        <form onSubmit={handleRunExperiment} className="space-y-4">
          <label
            htmlFor="what-if-input"
            className="block text-xs font-semibold text-[#3d4558]"
          >
            Ask a What-If Experiment Question
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="what-if-input"
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="e.g., What if atmospheric oxygen rose from 21% to 35%?"
              className="neu-input flex-1 px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="neu-btn flex min-h-[44px] items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-[#7c3aed] whitespace-nowrap disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Experiment</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div>
          <span className="block text-xs font-semibold text-[#5a6378]">
            Saved & Example Experiments
          </span>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {experiments.map((exp) => {
              const active = activeExperiment?.id === exp.id;
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => handleSelectExperiment(exp)}
                  className={`min-h-[40px] px-3.5 py-2 text-left text-xs ${
                    active
                      ? 'neu-btn-active font-semibold text-[#6366f1]'
                      : 'neu-btn font-medium text-[#3d4558]'
                  }`}
                >
                  {exp.title}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#5a6378]">
            <span>Try prompt:</span>
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuestionInput(q)}
                className="text-[#6366f1] hover:underline text-left"
              >
                “{q.slice(0, 42)}...”
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="neu-inset-sm flex items-start gap-2.5 p-3.5 text-xs text-[#b91c1c]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Two-Zone Sandbox Layout: Left Interactive Stage + Right Adjustable Assumptions */}
      {loading ? (
        <section className="neu-raised p-10 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#7c3aed]" />
          <p className="mt-3 text-sm font-semibold text-[#1e2436]">
            Running what-if prediction model and building parameters...
          </p>
        </section>
      ) : activeExperiment ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Interactive Simulation Stage (Left / 7 cols) */}
          <section className="neu-raised p-6 space-y-6 xl:col-span-7">
            <div className="border-b border-[#d4d8e2] pb-4">
              <p className="text-xs font-medium text-[#7c3aed]">
                {activeExperiment.domain}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#1e2436]">
                {activeExperiment.question}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#3d4558]">
                {activeExperiment.summary}
              </p>
            </div>

            {/* Baseline vs. Simulated Chart */}
            <div className="neu-inset p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#1e2436]">
                  Baseline vs. Simulated Impact Profile
                </h3>
                <div className="flex items-center gap-4 text-[11px] text-[#5a6378]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#9aa3b8]" />
                    Baseline
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#6366f1]" />
                    Simulated
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3.5">
                {dynamicChartSeries.map((point) => {
                  const baseW = Math.min(100, Math.round((point.baseline / maxChartVal) * 100));
                  const simW = Math.min(100, Math.round((point.simulated / maxChartVal) * 100));
                  return (
                    <div key={point.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#3d4558]">
                          {point.label}
                        </span>
                        <span className="font-mono-tabular text-[#1e2436]">
                          {point.baseline} →{' '}
                          <strong className="font-semibold text-[#6366f1]">
                            {point.simulated}
                          </strong>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded-lg bg-[#dfe2ea]">
                          <div
                            className="h-full rounded-lg bg-[#9aa3b8] transition-all duration-300"
                            style={{ width: `${baseW}%` }}
                          />
                        </div>
                        <div className="h-2 w-full rounded-lg bg-[#dfe2ea]">
                          <div
                            className="h-full rounded-lg bg-[#6366f1] transition-all duration-300"
                            style={{ width: `${simW}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI-Generated Predictions */}
            <div>
              <h3 className="text-sm font-semibold text-[#1e2436]">
                Key Predictions
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                {activeExperiment.predictions.map((pred, idx) => (
                  <div key={idx} className="neu-inset-sm p-4">
                    <p className="text-xs font-semibold text-[#6366f1]">
                      {pred.metric}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#1e2436]">
                      {pred.projectedOutcome}
                    </p>
                    <p className="mt-2 text-[11px] text-[#5a6378]">
                      Confidence: {pred.confidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Control Deck & Outcome Explanations (Right / 5 cols) */}
          <section className="space-y-6 xl:col-span-5">
            {/* Adjustable Assumptions */}
            <div className="neu-raised p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1e2436]">
                  <Sliders className="h-4 w-4 text-[#6366f1]" />
                  <span>Adjustable Assumptions</span>
                </div>
                <button
                  type="button"
                  onClick={() => setParamOverrides({})}
                  className="neu-btn flex items-center gap-1 px-3 py-1.5 text-xs text-[#5a6378]"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
              <p className="mt-1 text-xs text-[#5a6378]">
                Drag parameters to inspect how assumption shifts alter the simulated impact chart.
              </p>

              <div className="mt-5 space-y-5">
                {activeExperiment.parameters.map((param) => {
                  const val = getParamValue(param);
                  return (
                    <div key={param.id}>
                      <div className="flex items-center justify-between text-xs">
                        <label
                          htmlFor={`slider-${param.id}`}
                          className="font-semibold text-[#3d4558]"
                        >
                          {param.label}
                        </label>
                        <span className="font-mono-tabular font-semibold text-[#6366f1]">
                          {val} {param.unit}
                        </span>
                      </div>
                      <input
                        id={`slider-${param.id}`}
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={val}
                        onChange={(e) =>
                          setParamOverrides((prev) => ({
                            ...prev,
                            [param.id]: Number(e.target.value),
                          }))
                        }
                        className="neu-slider mt-2.5"
                      />
                      <div className="mt-1 flex justify-between font-mono-tabular text-[11px] text-[#5a6378]">
                        <span>
                          Min: {param.min} {param.unit}
                        </span>
                        <span>
                          Baseline: {param.baseline} {param.unit}
                        </span>
                        <span>
                          Max: {param.max} {param.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation of Outcomes */}
            <div className="neu-raised p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1e2436]">
                <FlaskConical className="h-4 w-4 text-[#7c3aed]" />
                <span>Explanation of Outcomes</span>
              </div>
              <ul className="mt-3.5 space-y-2.5">
                {activeExperiment.outcomeExplanation.map((item, idx) => (
                  <li
                    key={idx}
                    className="neu-inset-sm p-3.5 text-xs leading-relaxed text-[#3d4558]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Real-World Applications */}
            <div className="neu-raised p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1e2436]">
                <Compass className="h-4 w-4 text-[#059669]" />
                <span>Real-World Applications</span>
              </div>
              <div className="mt-3.5 space-y-3">
                {activeExperiment.realWorldApplications.map((app, idx) => (
                  <div key={idx} className="neu-inset-sm p-3.5">
                    <p className="text-xs font-semibold text-[#1e2436]">
                      {app.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#5a6378]">
                      {app.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
