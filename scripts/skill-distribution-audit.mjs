import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const scope = 'Skill distribution identity only: compares intended source, distribution manifest, and consumer discovery. Does not prove model loading or task execution.';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonblank = (value) => typeof value === 'string' && value.trim().length > 0;

function difference(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return {
    missing: [...leftSet].filter((identity) => !rightSet.has(identity)).sort(),
    extra: [...rightSet].filter((identity) => !leftSet.has(identity)).sort(),
  };
}

export function auditDistribution(input) {
  const issues = [];
  const add = (code, layer, detail, kind = 'inconclusive') => issues.push({ code, layer, detail, kind });
  const report = {
    schemaVersion: 1, status: 'inconclusive', scope, provesModelLoad: false,
    comparisons: {
      intendedManifest: null, intendedDiscovered: null, manifestDiscovered: null,
    },
    issues,
  };

  if (!object(input)) {
    add('invalid-input', 'input', 'Expected a JSON object.');
    return report;
  }
  if (input.schemaVersion !== 1) add('unsupported-schema', 'input', 'schemaVersion must be 1.');

  for (const layer of ['consumer', 'intended', 'manifest', 'discovered']) {
    if (!object(input[layer])) add('missing-object', layer, `${layer} must be an object.`);
  }

  const layers = {};
  for (const layer of ['intended', 'manifest', 'discovered']) {
    const value = input[layer];
    if (!object(value)) continue;
    if (!nonblank(value.sourceRevision)) {
      add('missing-source-revision', layer, `${layer}.sourceRevision must be a nonempty string.`);
    }
    if (!Array.isArray(value.identities)) {
      add('invalid-identities', layer, `${layer}.identities must be an array.`);
      continue;
    }
    const identities = value.identities;
    if (identities.some((identity) => !nonblank(identity))) {
      add('invalid-identity', layer, `${layer}.identities contains an empty or non-string identity.`);
      continue;
    }
    layers[layer] = identities;
    if (layer === 'intended' && identities.length === 0) {
      add('missing-intent', layer, 'An empty intended list does not establish intended distribution.');
    }
    const seen = new Set();
    const duplicates = new Set();
    for (const identity of identities) {
      if (seen.has(identity)) duplicates.add(identity);
      seen.add(identity);
    }
    if (duplicates.size > 0) {
      add('duplicate-identity', layer, `Duplicate identities: ${[...duplicates].join(', ')}`, 'mismatch');
    }
  }

  const consumer = input.consumer;
  const discovered = input.discovered;
  for (const [layer, value] of [['consumer', consumer], ['discovered.consumer', object(discovered) ? discovered.consumer : null]]) {
    if (!object(value) || !nonblank(value.name) || !nonblank(value.version)) {
      add('invalid-consumer', layer, `${layer} requires nonempty name and version.`);
    }
  }
  if (object(consumer) && object(discovered?.consumer) &&
      nonblank(consumer.name) && nonblank(consumer.version) &&
      nonblank(discovered.consumer.name) && nonblank(discovered.consumer.version) &&
      (consumer.name !== discovered.consumer.name || consumer.version !== discovered.consumer.version)) {
    add('consumer-mismatch', 'discovered', 'Discovered consumer name/version differs from requested consumer.');
  }

  if (object(discovered)) {
    if (discovered.complete !== true) {
      add('incomplete-discovery', 'discovered', 'Discovery must explicitly set complete to true; paging or truncation is inconclusive.');
    }
    if (discovered.errors !== undefined) {
      if (!Array.isArray(discovered.errors) || discovered.errors.some((error) => !nonblank(error))) {
        add('invalid-discovery-errors', 'discovered', 'errors must be an array of nonempty strings.');
      } else if (discovered.errors.length > 0) {
        add('discovery-errors', 'discovered', 'Discovery reported errors.');
      }
    }
  }

  const revisions = ['intended', 'manifest', 'discovered'].map((layer) => input[layer]?.sourceRevision);
  if (revisions.every(nonblank) && new Set(revisions).size !== 1) {
    add('source-revision-mismatch', 'input', 'All three sourceRevision values must match exactly.');
  }

  for (const [key, left, right] of [
    ['intendedManifest', 'intended', 'manifest'],
    ['intendedDiscovered', 'intended', 'discovered'],
    ['manifestDiscovered', 'manifest', 'discovered'],
  ]) {
    if (!layers[left] || !layers[right]) continue;
    const comparison = difference(layers[left], layers[right]);
    report.comparisons[key] = comparison;
    if (comparison.missing.length || comparison.extra.length) {
      add('identity-mismatch', key, `${key}: missing ${comparison.missing.length}, extra ${comparison.extra.length}.`, 'mismatch');
    }
  }

  if (issues.some((issue) => issue.kind === 'inconclusive')) report.status = 'inconclusive';
  else if (issues.length > 0) report.status = 'mismatch';
  else report.status = 'pass';
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let report;
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/skill-distribution-audit.mjs <input.json>');
    report = auditDistribution(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  } catch (error) {
    report = {
      schemaVersion: 1, status: 'inconclusive', scope, provesModelLoad: false,
      comparisons: { intendedManifest: null, intendedDiscovered: null, manifestDiscovered: null },
      issues: [{ code: 'invalid-input-file', layer: 'input', detail: error.message, kind: 'inconclusive' }],
    };
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = { pass: 0, mismatch: 1, inconclusive: 2 }[report.status];
}
