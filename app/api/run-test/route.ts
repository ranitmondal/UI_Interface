import { NextResponse } from 'next/server';
import { execPromise } from '../../lib/utils';
import * as fs from 'fs/promises';
import path from 'path';

interface TestResult {
  file: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: string;
  error?: string;
  retries?: number;
  browserName?: string;
}

function parseTestResults(output: string): { passed: boolean; results: TestResult[] } {
  const lines = output.split('\n');
  const results: TestResult[] = [];
  let passed = false;
  let currentError = '';
  let currentTest: Partial<TestResult> | null = null;

  // Look for any indication of test results
  const hasTestOutput = lines.some(line => 
    line.includes('test') || 
    line.includes('describe') || 
    line.includes('expect') ||
    line.includes('passed') ||
    line.includes('failed')
  );

  // If we have any test-related output, process it
  if (hasTestOutput) {
    // Check if all tests passed
    passed = !output.toLowerCase().includes('failed') && 
             !output.toLowerCase().includes('error') &&
             !output.toLowerCase().includes('timeout');

    // Try to extract individual test results
    for (const line of lines) {
      // Match test start lines like "[1/2] [chromium] › tests\test-two.spec.ts:3:5 › Test ONE"
      const testStartMatch = line.match(/\[(.*?)\] \[(.*?)\] › (.*?):(\d+):(\d+) › (.*?)$/);
      if (testStartMatch) {
        // If we have a previous test, save it
        if (currentTest) {
          results.push(currentTest as TestResult);
        }

        const [_, progress, browser, file, _line, _col, testName] = testStartMatch;
        currentTest = {
          file: path.basename(file),
          testName: testName.trim(),
          status: 'passed', // Default to passed, will be updated if we find errors
          duration: '0ms',
          browserName: browser,
          retries: 0
        };
        currentError = '';
        continue;
      }

      // Match retry attempts
      if (line.includes('retry #') && currentTest) {
        currentTest.retries = (currentTest.retries || 0) + 1;
        continue;
      }

      // Match duration lines like "  1) [chromium] › test.spec.ts:7:3 › test name (2s)"
      const durationMatch = line.match(/\(([\d.]+m?s)\)/);
      if (durationMatch && currentTest) {
        currentTest.duration = durationMatch[1];
        continue;
      }

      // Collect error messages
      if (currentTest && (line.includes('Error:') || line.includes('expect(') || currentError)) {
        currentError += line.trim() + '\n';
        currentTest.status = 'failed';
        currentTest.error = currentError.trim();
        continue;
      }

      // Check for timeouts (from Playwright's own timeout)
      if (currentTest && line.includes('Timed out')) {
        currentTest.status = 'timedOut';
        currentTest.error = 'Test execution timed out (as configured in Playwright)';
        continue;
      }

      // Check for skipped tests
      if (currentTest && line.includes('skipped')) {
        currentTest.status = 'skipped';
        continue;
      }
    }

    // Don't forget to add the last test if we have one
    if (currentTest) {
      results.push(currentTest as TestResult);
    }
  }

  // If we found no specific test results but have output, create a generic result
  if (results.length === 0 && hasTestOutput) {
    results.push({
      file: '',
      testName: 'Test Execution',
      status: passed ? 'passed' : 'failed',
      duration: '0ms',
      error: currentError || undefined
    });
  }

  return { passed, results };
}

export async function POST(request: Request) {
  try {
    const { file, index } = await request.json();
    const filename = path.basename(file);
    console.log('Running individual test from file:', filename);
    
    try {
      // Read the test file to get the test name for grep
      const fileContent = await fs.readFile(`tests/${filename}`, 'utf-8');
      const tests = fileContent.match(/test\(['"](.*?)['"]/g) || [];
      
      if (!tests[index]) {
        return NextResponse.json({
          status: 'failed',
          message: 'Test not found at specified index',
          error: `No test found at index ${index}`,
          output: '',
          testResults: [{
            file: filename,
            testName: 'Test Not Found',
            status: 'failed',
            duration: '0ms'
          }]
        });
      }
      
      // Extract the test name from the match
      const testNameMatch = tests[index].match(/test\(['"](.*)['"]/)!;
      const testName = testNameMatch[1];
      console.log('Found test name:', testName);

      try {
        // Run test using just the test name with --grep and --reporter=list for better output
        const command = `npx playwright test --grep "${testName}" --reporter=list`;
        console.log('Executing command:', command);
        
        const { stdout, stderr } = await execPromise(command);
        const output = stdout || stderr;
        console.log('Test execution output:', output);
        
        // If the output contains "No tests found", return a specific error
        if (output.includes('No tests found')) {
          return NextResponse.json({
            status: 'failed',
            message: 'Test not found',
            error: output,
            output: output,
            testResults: [{
              file: filename,
              testName: testName,
              status: 'failed',
              duration: '0ms',
              error: 'No matching tests found'
            }]
          });
        }
        
        // Parse test results from output
        const { passed, results } = parseTestResults(output);
        
        return NextResponse.json({
          status: passed ? 'passed' : 'failed',
          message: passed ? 'Test executed successfully' : 'Test failed',
          error: stderr || '',
          output: output,
          testResults: results
        });
        
      } catch (execError: any) {
        // Handle test execution errors - this means tests ran but failed
        const output = execError.stdout || '';
        const errorOutput = execError.stderr || '';
        
        console.log('Test execution failed:', {
          stdout: output,
          stderr: errorOutput
        });
        
        // Try to parse results even from failed execution
        const { results } = parseTestResults(output || errorOutput);
        
        return NextResponse.json({
          status: 'failed',
          message: 'Test failed',
          error: errorOutput || execError.message,
          output: output || errorOutput,
          testResults: results.length > 0 ? results : [{
            file: filename,
            testName: testName,
            status: 'failed',
            duration: '0ms',
            error: errorOutput || execError.message
          }]
        });
      }
      
    } catch (error) {
      // This catch block handles API errors, not test failures
      console.error('API error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({
        status: 'failed',
        message: 'Failed to execute test',
        error: errorMessage,
        output: '',
        testResults: [{
          file: filename,
          testName: 'Test Execution',
          status: 'failed',
          duration: '0ms',
          error: errorMessage
        }]
      });
    }
  } catch (error) {
    // This catch block handles request parsing errors
    console.error('Request parsing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: 'failed',
      message: 'Invalid request',
      error: errorMessage,
      output: '',
      testResults: [{
        file: '',
        testName: 'Invalid Request',
        status: 'failed',
        duration: '0ms',
        error: errorMessage
      }]
    }, { status: 400 });
  }
}