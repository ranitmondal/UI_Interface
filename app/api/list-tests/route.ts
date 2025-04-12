import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface TestCase {
  name: string;
  file: string;
  index: number;
  status: 'pending' | 'running' | 'passed' | 'failed';
  lastRun?: string;
}

interface TestSuite {
  name: string;
  file: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  lastRun?: string;
  tests: TestCase[];
}

export async function GET() {
  try {
    console.log('API Route: Starting to fetch tests');
    const projectRoot = process.cwd();
    console.log('Looking for tests in project root:', projectRoot);

    // Function to recursively find test files
    const findTestFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = entries
        .filter(file => !file.isDirectory() && (file.name.endsWith('.spec.ts') || file.name.endsWith('.test.ts')))
        .map(file => path.join(dir, file.name));
      
      const folders = entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(dir, entry.name));
      
      const subFiles = folders.flatMap(folder => findTestFiles(folder));
      return [...files, ...subFiles];
    };

    const testFiles = findTestFiles(projectRoot);
    console.log('Found test files:', testFiles);

    const testSuites: TestSuite[] = await Promise.all(testFiles.map(async (filePath) => {
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse individual tests from the file content
      const testMatches = Array.from(content.matchAll(/test\(['"](.*?)['"]/g));
      const tests = testMatches.map((match, testIndex) => ({
        name: match[1],
        file: relativePath,
        index: testIndex,
        status: 'pending' as const,
        lastRun: undefined
      }));

      return {
        name: path.basename(relativePath, path.extname(relativePath)),
        file: relativePath,
        status: 'pending' as const,
        lastRun: undefined,
        tests
      };
    }));

    console.log('Returning test suites:', testSuites);

    return NextResponse.json(
      { testSuites },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (error) {
    console.error('Error in list-tests API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 