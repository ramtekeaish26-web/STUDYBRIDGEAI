import { ExperimentChartPoint, ExperimentParameter } from '../types/study';

export function sanitizeExperimentParameters(
  params: unknown
): ExperimentParameter[] {
  if (!Array.isArray(params)) return [];
  return params
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
    .map((raw, idx) => {
      const min = Number.isFinite(Number(raw.min)) ? Number(raw.min) : 0;
      const rawMax = Number.isFinite(Number(raw.max)) ? Number(raw.max) : min + 100;
      const max = rawMax > min ? rawMax : min + 10;
      const step = Number(raw.step) > 0 ? Number(raw.step) : Math.max((max - min) / 20, 0.1);
      const rawBaseline = Number.isFinite(Number(raw.baseline)) ? Number(raw.baseline) : min;
      const baseline = Math.min(Math.max(rawBaseline, min), max);
      const rawVal = Number.isFinite(Number(raw.value)) ? Number(raw.value) : baseline;
      const value = Math.min(Math.max(rawVal, min), max);
      const sensitivity = Number.isFinite(Number(raw.sensitivity))
        ? Math.min(Math.max(Number(raw.sensitivity), -2), 2)
        : 0.75;

      return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `param-${idx + 1}`,
        label:
          typeof raw.label === 'string' && raw.label.trim()
            ? raw.label.trim()
            : `Parameter ${idx + 1}`,
        unit: typeof raw.unit === 'string' ? raw.unit : '',
        min,
        max,
        step,
        baseline,
        value,
        sensitivity,
      };
    });
}

export function computeSimulatedChartSeries(
  chartSeries: ExperimentChartPoint[],
  parameters: ExperimentParameter[],
  paramOverrides: Record<string, number>
): ExperimentChartPoint[] {
  if (parameters.length === 0 || chartSeries.length === 0) {
    return chartSeries;
  }

  const avgShiftFactor =
    parameters.reduce((acc, p) => {
      const current = paramOverrides[p.id] !== undefined ? paramOverrides[p.id] : p.value;
      const span = Math.max(p.max - p.min, 0.0001);
      const deltaRatio = (current - p.value) / span;
      return acc + deltaRatio * p.sensitivity;
    }, 0) / parameters.length;

  // Preserve exact initial simulated metrics when sliders are at their starting values
  if (Math.abs(avgShiftFactor) < 1e-6) {
    return chartSeries;
  }

  return chartSeries.map((pt, idx) => {
    const direction = idx % 2 === 0 ? 1 : -1;
    const rawAdjusted = pt.simulated * (1 + avgShiftFactor * 0.65 * direction);
    const adjusted =
      Math.abs(pt.simulated) < 10
        ? Math.max(0.1, Number(rawAdjusted.toFixed(2)))
        : Math.max(1, Math.round(rawAdjusted));

    return {
      ...pt,
      simulated: adjusted,
    };
  });
}
