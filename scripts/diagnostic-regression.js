const fs = require('node:fs');

const os = require('node:os');

const path = require('node:path');

const { spawnSync } = require('node:child_process');

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytzt-diagnostic-test-'));

const scriptPath = path.join(__dirname, 'diagnose_zen_toggle_resize.py');

const result = spawnSync(
  'python3',
  [scriptPath, '--helium', path.join(outputDir, 'missing-helium'), '--output-dir', outputDir],
  { encoding: 'utf8' }
);

try {
  if (result.status !== 2) {
    throw new Error(`expected blocked diagnostic exit 2, got ${result.status}: ${result.stderr}`);
  }

  const reportPath = path.join(outputDir, 'report.json');
  assert(fs.existsSync(reportPath), 'diagnostic did not persist report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert(report.status === 'blocked', `unexpected diagnostic status: ${report.status}`);
  assert(Array.isArray(report.measurements), 'diagnostic report measurements are not an array');
  assert(!Object.hasOwn(report, 'url'), 'diagnostic report persisted a personal tab URL');

  const redaction = spawnSync(
    'python3',
    [
      '-c',
      `import importlib.util, sys
spec = importlib.util.spec_from_file_location('diagnostic', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
redacted = module.redact_error('navigation failed at https://www.youtube.com/watch?v=private&list=secret')
assert 'private' not in redacted and 'secret' not in redacted and '[URL redacted]' in redacted
`,
      scriptPath
    ],
    { encoding: 'utf8' }
  );

  assert(redaction.status === 0, `diagnostic error redaction failed: ${redaction.stderr}`);
  console.log('diagnostic regression: PASS (blocked report serialized without network or tab data)');
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
