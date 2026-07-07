#!/usr/bin/env node
const TARGETS = [
  'https://takuzo-taxi.com',
];

async function check(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    return {
      url,
      ok: response.status === 200,
      status: response.status,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: null,
      message: error.message,
    };
  }
}

const results = await Promise.all(TARGETS.map(check));
let hasFailure = false;

for (const result of results) {
  const label = result.ok ? 'OK' : 'NG';
  if (!result.ok) hasFailure = true;
  console.log(`${label} ${result.url} - ${result.message}`);
}

if (hasFailure) process.exit(1);
