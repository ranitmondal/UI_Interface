import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const testDir = path.join(process.cwd(), 'Interface', 'tests');

  try {
    const files = fs.readdirSync(testDir);
    const testFiles = files.filter(file => file.endsWith('.spec.ts') || file.endsWith('.spec.js'));

    const testCases = testFiles.map((file, index) => {
      const name = file.replace(/\.spec\.(ts|js)/, '').replace(/[-_]/g, ' ');
      return {
        id: `test-${index + 1}`,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        description: `Runs the test in ${file}`,
        filename: `Interface/tests/${file}`,
        status: 'idle',
        lastRun: null,
      };
    });

    res.status(200).json({ tests: testCases });
  } catch (err) {
    console.error('Error reading test directory:', err);
    res.status(500).json({ error: 'Failed to list test files' });
  }
}
