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

function sanitizeString(str: string): string {
  // Remove null characters and invalid Unicode sequences
  return str.replace(/\u0000/g, '').replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

function parseTestResults(output: string): { passed: boolean; results: TestResult[] } {
  // Sanitize the output first
  const sanitizedOutput = sanitizeString(output);
  const lines = sanitizedOutput.split('\n');
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
    passed = !sanitizedOutput.toLowerCase().includes('failed') && 
             !sanitizedOutput.toLowerCase().includes('error') &&
             !sanitizedOutput.toLowerCase().includes('timeout');

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
    console.log('Running test from file:', file);
    
    try {
      // Read the test file to get the test name for grep
      const fileContent = await fs.readFile(file, 'utf-8');
      console.log('File content:', fileContent);

      // Sanitize the file path and content
      const sanitizedFile = sanitizeString(file);
      const sanitizedContent = sanitizeString(fileContent);
      
      // Match test declarations more precisely
      const tests = Array.from(sanitizedContent.matchAll(/test\s*\(\s*["']([^"']+)["']/g));
      console.log('Found tests:', tests.map(t => t[1]));
      
      if (!tests[index]) {
        return NextResponse.json({
          status: 'failed',
          message: 'Test not found at specified index',
          error: `No test found at index ${index}`,
          output: '',
          testResults: [{
            file: file,
            testName: 'Test Not Found',
            status: 'failed',
            duration: '0ms'
          }]
        });
      }
      
      // Extract the test name and escape special characters
      const testName = tests[index][1];
      console.log('Found test name:', testName);
      
      // Escape special characters in the test name for the grep pattern
      const escapedTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      console.log('Escaped test name for grep:', escapedTestName);

      try {
        // Use tests directory as working directory
        const testsDir = path.join(process.cwd(), 'tests');
        const options = {
          cwd: testsDir,
          env: { ...process.env },
          maxBuffer: 1024 * 1024 * 100 // 10MB buffer
        };

        // Get just the filename without the tests/ prefix
        const filename = path.basename(file);
        
        // Construct command with simpler grep pattern
        const command = `npx playwright test "${filename}" --grep="${testName}"`;
        
        console.log('Working directory:', options.cwd);
        console.log('Full command:', command);
        console.log('Test name being searched:', testName);

        const { stdout, stderr } = await execPromise(command, options);
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
              file: file,
              testName: testName,
              status: 'failed',
              duration: '0ms',
              error: 'No matching tests found'
            }]
          });
        }
        
        // Parse test results from output
        const { passed, results } = parseTestResults(output);
        
        // Sanitize all string fields in the response
        const sanitizedResults = results.map(result => ({
          ...result,
          file: sanitizeString(result.file),
          testName: sanitizeString(result.testName),
          error: result.error ? sanitizeString(result.error) : undefined,
          duration: sanitizeString(result.duration)
        }));
        
        return NextResponse.json({
          status: passed ? 'passed' : 'failed',
          message: passed ? 'Test executed successfully' : 'Test failed',
          error: stderr ? sanitizeString(stderr) : '',
          output: sanitizeString(output),
          testResults: sanitizedResults
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
            file: file,
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
          file: file,
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