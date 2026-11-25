import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSimulatedChartSeries,
  sanitizeExperimentParameters,
} from '../src/utils/experimentMath';
import { SAMPLE_EXPERIMENTS } from '../src/data/sampleData';

test('computeSimulatedChartSeries preserves decimal baseline metrics when sliders are unchanged', () => {
  const gravityExp = SAMPLE_EXPERIMENTS[0];
  const untouched = computeSimulatedChartSeries(
    gravityExp.chartSeries,
    gravityExp.parameters,
    {}
  );

  assert.deepEqual(untouched, gravityExp.chartSeries);
  const scaleHeight = untouched.find((pt) => pt.label.includes('Scale Height'));
  assert.ok(scaleHeight, 'Expected Scale Height point in gravity experiment');
  assert.equal(scaleHeight.simulated, 4.25);
});

test('computeSimulatedChartSeries responds accurately to sub-unit slider spans (e.g. Ocean pH)', () => {
  const oceanExp = SAMPLE_EXPERIMENTS[1];
  const phParam = oceanExp.parameters.find((p) => p.id === 'oceanPh');
  assert.ok(phParam, 'Expected oceanPh parameter');
  assert.ok(phParam.max - phParam.min < 1, 'Ocean pH span should be sub-unit (< 1)');

  const baselineSeries = computeSimulatedChartSeries(
    oceanExp.chartSeries,
    oceanExp.parameters,
    {}
  );
  const shiftedSeries = computeSimulatedChartSeries(
    oceanExp.chartSeries,
    oceanExp.parameters,
    { [phParam.id]: phParam.min }
  );

  assert.notDeepEqual(shiftedSeries, baselineSeries);
  assert.notEqual(shiftedSeries[0].simulated, baselineSeries[0].simulated);
});

test('sanitizeExperimentParameters repairs malformed min/max/step/baseline bounds', () => {
  const sanitized = sanitizeExperimentParameters([
    {
      id: '',
      label: 'Temperature',
      unit: 'C',
      min: 50,
      max: 20, // invalid: max < min
      step: 0, // invalid: non-positive step
      baseline: 100, // out of range
      value: -10, // out of range
      sensitivity: 10, // should clamp to [-2, 2]
    },
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].id, 'param-1');
  assert.ok(sanitized[0].max > sanitized[0].min);
  assert.ok(sanitized[0].step > 0);
  assert.ok(sanitized[0].baseline >= sanitized[0].min && sanitized[0].baseline <= sanitized[0].max);
  assert.ok(sanitized[0].value >= sanitized[0].min && sanitized[0].value <= sanitized[0].max);
  assert.equal(sanitized[0].sensitivity, 2);
});
