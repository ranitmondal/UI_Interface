import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { testPath } = req.body;
  if (!testPath) return res.status(400).json({ error: 'Missing testPath' });

  const fullTestPath = path.join(process.cwd(), testPath);

  exec(`npx playwright test ${fullTestPath}`, (error, stdout, stderr) => {
    if (error) return res.status(200).json({ status: 'failed', output: stderr });
    return res.status(200).json({ status: 'passed', output: stdout });
  });
}
