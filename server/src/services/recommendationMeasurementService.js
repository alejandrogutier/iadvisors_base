const cron = require('node-cron');
const { client } = require('../openaiClient');
const {
  recordRecommendationMeasurement,
  hasRecommendationMeasurementForDate,
  getRecommendationMeasurementAggregates,
  listBrands,
  getBrandById
} = require('../db');

const defaultCronExpression = process.env.MEASUREMENT_CRON || '0 6 * * *';
const measurementSystemPrompt = `Eres un analista de desempeño de marcas farmacéuticas.
Responde únicamente con el nombre de la marca más adecuada según la pregunta suministrada.
No proporciones explicaciones ni agregues palabras extra.
El resultado debe ser un JSON válido con el formato exacto {"brand": "NOMBRE_DE_LA_MARCA"}.
Si la consulta no hace referencia a una marca específica, selecciona la mejor alternativa posible.`;

const jsonResponseFormat = {
  type: 'json_schema',
  name: 'brand_recommendation',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      brand: {
        type: 'string',
        description: 'Nombre comercial de la marca recomendada'
      }
    },
    required: ['brand']
  }
};

function normalizeBrandName(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatBrandLabel(value = '') {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Sin marca';
  }
  return trimmed.replace(/\s+/g, ' ');
}

async function queryBrandRecommendation({ question, model }) {
  const targetModel = model || 'gpt-4o-mini';
  const response = await client.responses.create({
    model: targetModel,
    temperature: 0.2,
    max_output_tokens: 200,
    text: {
      format: jsonResponseFormat
    },
    input: [
      { role: 'system', content: measurementSystemPrompt },
      { role: 'user', content: question }
    ]
  });

  let payload = '';
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    payload = response.output_text.trim();
  } else if (Array.isArray(response.output_text) && response.output_text.length) {
    payload = response.output_text.join('\n').trim();
  } else if (Array.isArray(response.output)) {
    const textBlocks = [];
    for (const block of response.output) {
      if (!block?.content) continue;
      for (const contentBlock of block.content) {
        if (contentBlock?.text?.value) {
          textBlocks.push(contentBlock.text.value);
        } else if (typeof contentBlock?.text === 'string') {
          textBlocks.push(contentBlock.text);
        } else if (contentBlock?.output_text) {
          textBlocks.push(contentBlock.output_text);
        }
      }
    }
    payload = textBlocks.join('\n').trim();
  }
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload);
    if (parsed?.brand && typeof parsed.brand === 'string') {
      return formatBrandLabel(parsed.brand);
    }
  } catch (error) {
    // ignore individual parse errors
  }
  return null;
}

async function runMeasurementForType({
  brand,
  promptConfig,
  measurementDate,
  sampleSize,
  force
}) {
  if (!promptConfig?.question || !promptConfig.key) {
    throw new Error('Configuración de medición inválida');
  }
  const measurementType = promptConfig.key;

  if (
    !force &&
    hasRecommendationMeasurementForDate({
      measurementType,
      measurementDate,
      brandId: brand.id
    })
  ) {
    return {
      measurementType,
      measurementDate,
      skipped: true,
      saved: 0,
      attempts: 0
    };
  }

  let saved = 0;
  let attempts = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    attempts += 1;
    try {
      const brandRecommendation = await queryBrandRecommendation({
        question: promptConfig.question,
        model: brand.measurement?.model
      });
      if (!brandRecommendation) {
        continue;
      }
      const normalizedBrand = normalizeBrandName(brandRecommendation) || 'sin_dato';
      recordRecommendationMeasurement({
        measurementType,
        promptType: promptConfig.promptType || promptConfig.key,
        brand: brandRecommendation,
        normalizedBrand,
        measurementDate,
        sampleIndex: index,
        rawResponse: brandRecommendation,
        brandId: brand.id
      });
      saved += 1;
    } catch (error) {
      console.error('Error registrando medición', measurementType, error.message);
    }
  }

  return {
    measurementType,
    measurementDate,
    saved,
    attempts,
    skipped: false
  };
}

function formatDateInput(value) {
  if (!value) {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

async function runDailyRecommendationMeasurements(options = {}) {
  const measurementDate = formatDateInput(options.measurementDate);
  const force = Boolean(options.force);
  let brands = [];
  if (options.brandId) {
    const brand = getBrandById(options.brandId);
    if (!brand) {
      throw new Error('Marca no encontrada para mediciones');
    }
    brands = [brand];
  } else {
    brands = listBrands();
  }

  const results = [];
  for (const brand of brands) {
    const measurementConfig = brand.measurement || {};
    const sampleSize = options.sampleSize || measurementConfig.sampleSize || 1;
    const prompts = Array.isArray(measurementConfig.prompts)
      ? measurementConfig.prompts
      : [];
    const runs = [];
    // eslint-disable-next-line no-await-in-loop
    for (const prompt of prompts) {
      // eslint-disable-next-line no-await-in-loop
      const outcome = await runMeasurementForType({
        brand,
        promptConfig: prompt,
        measurementDate,
        sampleSize,
        force
      });
      runs.push(outcome);
    }
    results.push({
      brandId: brand.id,
      brandName: brand.name,
      runs
    });
  }

  return {
    measurementDate,
    results
  };
}

function ensureDateRange(value, fallbackDays = 30) {
  const requestedEnd = value?.endDate ? new Date(value.endDate) : null;
  const safeEnd = requestedEnd && !Number.isNaN(requestedEnd.getTime()) ? requestedEnd : new Date();
  let start = null;
  if (value?.startDate) {
    const requestedStart = new Date(value.startDate);
    if (!Number.isNaN(requestedStart.getTime())) {
      start = requestedStart;
    }
  }
  if (!start) {
    start = new Date(safeEnd);
    start.setDate(safeEnd.getDate() - (fallbackDays - 1));
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: safeEnd.toISOString().slice(0, 10)
  };
}

function buildMeasurementSummary(measurementType, aggregates) {
  const { totalsByBrand, totalsByDateBrand, totalsByType } = aggregates;
  const totalSamples = totalsByType.find((item) => item.measurement_type === measurementType)?.total || 0;
  const brandTotals = totalsByBrand
    .filter((item) => item.measurement_type === measurementType)
    .sort((a, b) => b.total - a.total);
  const topFive = brandTotals.slice(0, 5);
  const normalizedTopSet = new Set(topFive.map((item) => item.normalized_brand));
  const normalizedToLabel = new Map(topFive.map((item) => [item.normalized_brand, item.brand]));

  const chartMap = new Map();
  totalsByDateBrand
    .filter((item) => item.measurement_type === measurementType)
    .forEach((item) => {
      const label = normalizedTopSet.has(item.normalized_brand)
        ? normalizedToLabel.get(item.normalized_brand)
        : 'Otras';
      const key = `${item.measurement_date}_${label}`;
      if (!chartMap.has(key)) {
        chartMap.set(key, {
          date: item.measurement_date,
          brand: label,
          total: 0
        });
      }
      chartMap.get(key).total += item.total;
    });
  const chartSeries = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const table = brandTotals.slice(0, 10).map((item) => ({
    brand: item.brand,
    total: item.total,
    percentage: totalSamples ? item.total / totalSamples : 0
  }));

  return {
    measurementType,
    totalSamples,
    chartSeries,
    table,
    topBrands: topFive.map((item) => item.brand)
  };
}

function getMeasurementsDashboard(rangeOptions = {}) {
  if (!rangeOptions.brandId) {
    throw new Error('brandId es requerido para la analítica de mediciones');
  }
  const brand = getBrandById(rangeOptions.brandId);
  if (!brand) {
    throw new Error('Marca no encontrada para la analítica');
  }
  const range = ensureDateRange(rangeOptions);
  const aggregates = getRecommendationMeasurementAggregates({
    ...range,
    brandId: brand.id
  });
  const prompts = Array.isArray(brand.measurement?.prompts)
    ? brand.measurement.prompts
    : [];
  const summaries = prompts.reduce((acc, prompt) => {
    acc[prompt.key] = buildMeasurementSummary(prompt.key, aggregates);
    return acc;
  }, {});
  const latestRuns = aggregates.latestRuns.reduce((acc, item) => {
    acc[item.measurement_type] = {
      lastCreatedAt: item.last_created_at,
      lastMeasurementDate: item.last_measurement_date
    };
    return acc;
  }, {});

  return {
    range,
    sampleSize: brand.measurement?.sampleSize || 0,
    cron: brand.measurement?.cron || defaultCronExpression,
    prompts,
    summaries,
    latestRuns
  };
}

function scheduleRecommendationMeasurementJob() {
  if (process.env.DISABLE_MEASUREMENT_JOB === 'true') {
    console.warn('Measurement job deshabilitado por variable de entorno');
    return null;
  }
  const brands = listBrands();
  const tasks = [];
  brands.forEach((brand) => {
    const expression = brand.measurement?.cron || defaultCronExpression;
    try {
      const task = cron.schedule(expression, () => {
        runDailyRecommendationMeasurements({ brandId: brand.id }).catch((error) => {
          console.error(`Error ejecutando mediciones de ${brand.name}`, error.message);
        });
      });
      tasks.push(task);
    } catch (error) {
      console.error(`No se pudo programar mediciones para ${brand.name}`, error.message);
    }
    runDailyRecommendationMeasurements({ brandId: brand.id }).catch((error) => {
      console.error(`Error en medición inicial de ${brand.name}`, error.message);
    });
  });
  return tasks;
}

module.exports = {
  scheduleRecommendationMeasurementJob,
  runDailyRecommendationMeasurements,
  getMeasurementsDashboard
};
