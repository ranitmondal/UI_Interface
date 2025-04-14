import { NextResponse } from 'next/server';
import { execPromise } from '../../lib/utils';
import path from 'path';

type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

interface TestResult {
  file: string;
  testName: string;
  status: TestStatus;
  duration: string;
  error?: string;
}

function parseTestResults(output: string): { passed: boolean; results: TestResult[] } {
  const lines = output.split('\n');
  const results: TestResult[] = [];
  let passed = true;

  // Regular expression to match test result lines
  const testLineRegex = /\s+([✓✘-])\s+\d+\s+\[chromium\]\s+›\s+(.*?):(\d+):(\d+)\s+›\s+(.*?)\s+(?:\((.*?)\))?$/;

  for (const line of lines) {
    const match = line.match(testLineRegex);
    if (match) {
      const [_, status, filePath, _line, _col, testName, duration] = match;
      
      let testStatus: TestStatus;
      switch (status) {
        case '✓':
          testStatus = 'passed';
          break;
        case '✘':
          testStatus = 'failed';
          passed = false;
          break;
        case '-':
          testStatus = 'pending';
          break;
        default:
          testStatus = 'failed';
          passed = false;
      }

      results.push({
        file: path.basename(filePath.trim()),
        testName: testName.trim(),
        status: testStatus,
        duration: duration || '0ms'
      });
    }
  }

  // If we found no results but have error output, create a failed result
  if (results.length === 0 && output.includes('failed')) {
    results.push({
      file: '',
      testName: 'Test Execution',
      status: 'failed',
      duration: '0ms',
      error: output
    });
    passed = false;
  }

  return { passed, results };
}

export async function POST() {
  try {
    console.log('Running all tests in the project');
    console.log('Current working directory:', process.cwd());
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH
    });

    try {
      // Run all tests using list reporter for better output
      const command = 'npx playwright test --reporter=list';
      console.log('Executing command:', command);
      
      const options = {
        cwd: process.cwd(),
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      };

      console.log('Working directory:', options.cwd);
      
      const { stdout, stderr } = await execPromise(command, options);
      const output = stdout || stderr;
      console.log('Test execution output:', output);

      // Handle no tests found
      if (output.includes('No tests found')) {
        return NextResponse.json({
          status: 'failed',
          message: 'No tests found in the project',
          error: output,
          output: output,
          testResults: [{
            file: '',
            testName: 'No Tests Found',
            status: 'failed' as TestStatus,
            duration: '0ms',
            error: 'No tests found in the project'
          }]
        });
      }

      // Parse test results
      const { passed, results } = parseTestResults(output);

      return NextResponse.json({
        status: passed ? 'passed' : 'failed',
        message: passed ? 'All tests executed successfully' : 'Some tests failed',
        error: stderr || '',
        output: output,
        testResults: results
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });

    } catch (execError: any) {
      // Handle test execution errors
      const output = execError.stdout || '';
      const errorOutput = execError.stderr || '';
      
      console.error('Test execution failed:', {
        error: execError,
        code: execError.code,
        signal: execError.signal,
        stdout: output,
        stderr: errorOutput,
        cmd: execError.cmd,
        killed: execError.killed
      });
      
      // Try to parse results even from failed execution
      const { results } = parseTestResults(output || errorOutput);
      
      return NextResponse.json({
        status: 'failed',
        message: 'Tests failed',
        error: errorOutput || execError.message,
        output: output || errorOutput,
        testResults: results.length > 0 ? results : [{
          file: '',
          testName: 'Test Execution',
          status: 'failed' as TestStatus,
          duration: '0ms',
          error: errorOutput || execError.message
        }]
      });
    }

  } catch (error) {
    // Handle API errors
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: 'failed',
      message: 'Failed to execute tests',
      error: errorMessage,
      output: '',
      testResults: [{
        file: '',
        testName: 'API Error',
        status: 'failed' as TestStatus,
        duration: '0ms',
        error: errorMessage
      }]
    }, { status: 500 });
  }
}