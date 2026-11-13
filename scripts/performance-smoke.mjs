#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const requestCount = positiveInteger('REQUESTS', 100);
const concurrency = positiveInteger('CONCURRENCY', 10);
const maxP95Ms = positiveNumber('MAX_P95_MS', 1500);
const maxErrorRate = nonNegativeNumber('MAX_ERROR_RATE', 0.01);

const email = process.env.PERF_EMAIL ?? `performance-${Date.now()}-${process.pid}@example.com`;
const password = process.env.PERF_PASSWORD ?? 'secret123';

const registration = await requestJson('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    firstName: 'Performance',
    lastName: 'Smoke',
    phoneNumber: '+905551112233',
    preferredLanguage: 'en',
    password
  })
});

if (!registration.accessToken) {
  throw new Error('Registration response did not contain an access token.');
}

const authorization = `Bearer ${registration.accessToken}`;
await requestJson('/api/reminders', { headers: { Authorization: authorization } });

const latencies = [];
const failures = [];
let nextRequest = 0;
const startedAt = performance.now();

await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, async () => {
  while (true) {
    const requestNumber = nextRequest++;
    if (requestNumber >= requestCount) {
      return;
    }

    const requestStartedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}/api/reminders`, {
        headers: { Authorization: authorization }
      });
      const latency = performance.now() - requestStartedAt;
      latencies.push(latency);
      if (!response.ok) {
        failures.push({ requestNumber, status: response.status });
      }
      await response.arrayBuffer();
    } catch (error) {
      latencies.push(performance.now() - requestStartedAt);
      failures.push({ requestNumber, error: error instanceof Error ? error.message : String(error) });
    }
  }
}));

const elapsedSeconds = (performance.now() - startedAt) / 1000;
latencies.sort((left, right) => left - right);
const p50 = percentile(latencies, 0.50);
const p95 = percentile(latencies, 0.95);
const p99 = percentile(latencies, 0.99);
const errorRate = failures.length / requestCount;
const result = {
  target: `${baseUrl}/api/reminders`,
  requests: requestCount,
  concurrency,
  throughputPerSecond: rounded(requestCount / elapsedSeconds),
  latencyMs: {
    min: rounded(latencies[0]),
    p50: rounded(p50),
    p95: rounded(p95),
    p99: rounded(p99),
    max: rounded(latencies.at(-1))
  },
  failures: failures.length,
  errorRate: rounded(errorRate)
};

console.log(JSON.stringify(result, null, 2));

if (errorRate > maxErrorRate || p95 > maxP95Ms) {
  if (failures.length) {
    console.error('Failure sample:', JSON.stringify(failures.slice(0, 5)));
  }
  console.error(`Performance gate failed: p95 <= ${maxP95Ms} ms and error rate <= ${maxErrorRate} required.`);
  process.exitCode = 1;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

function percentile(values, quantile) {
  if (!values.length) {
    return 0;
  }
  return values[Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)];
}

function positiveInteger(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}

function nonNegativeNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return value;
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}
