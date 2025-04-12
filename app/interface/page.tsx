'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Play, CheckCircle, XCircle, Loader, Clock, ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';
import path from 'path';

type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

interface TestCase {
  name: string;
  file: string;
  index: number;
  status: TestStatus;
  lastRun?: string;
}

interface TestSuite {
  name: string;
  file: string;
  status: TestStatus;
  lastRun?: string;
  tests: TestCase[];
}

interface TestResult {
  file: string;
  testName: string;
  status: TestStatus;
  duration: string;
  error?: string;
}

interface TestResponse {
  status: 'passed' | 'failed';
  message: string;
  error?: string;
  output: string;
  testResults: TestResult[];
}

// Helper function to convert API test status to UI test status
function convertTestStatus(status: TestStatus): TestStatus {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'running':
      return 'running';
    case 'pending':
      return 'pending';
  }
}

// Helper function to check if a string contains at least 3 consecutive matching characters
const hasConsecutiveMatch = (text: string, searchTerm: string) => {
  text = text.toLowerCase();
  searchTerm = searchTerm.toLowerCase();
  
  // Check for consecutive character matches
  for (let i = 0; i <= text.length - searchTerm.length; i++) {
    const substring = text.substr(i, searchTerm.length);
    if (substring === searchTerm) {
      return true;
    }
  }
  return false;
};

export default function Interface() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runningAllTests, setRunningAllTests] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TestStatus | 'all'>('all');

  // Add a computed value to check if any test is running
  const isAnyTestRunning = useCallback(() => {
    return testSuites.some(suite => 
      suite.status === 'running' || suite.tests.some(test => test.status === 'running')
    );
  }, [testSuites]);

  // Update the button's disabled state to use the computed value
  const isButtonsDisabled = isTestRunning || runningAllTests || isAnyTestRunning();

  const showError = (message: string) => {
    setError(message);
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setError(null);
    }, 10000);
  };

  const ErrorNotification = ({ message, onClose }: { message: string; onClose: () => void }) => {
    useEffect(() => {
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 10000);

      // Cleanup timer on unmount
      return () => clearTimeout(timer);
    }, [onClose]);

    return (
      <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
        <div className="flex-1">
          <span className="mr-2">⚠️</span>
          {message}
        </div>
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-800 focus:outline-none"
        >
          <span className="sr-only">Close</span>
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    );
  };

  const fetchTests = useCallback(async () => {
    try {
      console.log('Fetching tests from /api/list-tests...');
      setIsRefreshing(true);
      setError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/list-tests', {
        signal: controller.signal
      }).catch(err => {
        console.error('Fetch error:', err);
        throw new Error('Failed to connect to the server. Please check if the server is running.');
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched data:', data);
      
      if (!data.testSuites) {
        throw new Error('Invalid response format: missing testSuites array');
      }
      
      setTestSuites(data.testSuites);
    } catch (err) {
      console.error('Error in fetchTests:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching tests');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const toggleSuite = (file: string) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(file)) {
        newSet.delete(file);
      } else {
        newSet.add(file);
      }
      return newSet;
    });
  };

  const handleRunTest = async (file: string, index: number) => {
    try {
      setIsTestRunning(true);
      const currentTime = new Date().toISOString();
      
      // Update UI to show test is running
      setTestSuites(prevSuites => 
        prevSuites.map(suite => {
          if (suite.file === file) {
            return {
              ...suite,
              tests: suite.tests.map(test => ({
                ...test,
                status: test.index === index ? ('running' as const) : test.status,
                lastRun: test.index === index ? currentTime : test.lastRun
              }))
            };
          }
          return suite;
        })
      );

      // Set up timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        const response = await fetch('/api/run-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ file, index }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to run test');
        }

        const data: TestResponse = await response.json();
        console.log('Individual test response:', data);
        
        // Update test status and timestamp
        setTestSuites(prevSuites => 
          prevSuites.map(suite => {
            if (suite.file === file) {
              const updatedTests = suite.tests.map(test => {
                if (test.index === index) {
                  // If we have specific test results, use them
                  if (data.testResults && data.testResults.length > 0) {
                    const testResult = data.testResults[0]; // For individual tests, we expect only one result
                    const newStatus: TestCase['status'] = testResult.status === 'passed' ? 'passed' : 'failed';
                    return {
                      ...test,
                      status: newStatus,
                      lastRun: currentTime
                    };
                  }
                  // If no test results or test failed, mark as failed
                  const newStatus: TestCase['status'] = data.status === 'passed' ? 'passed' : 'failed';
                  return {
                    ...test,
                    status: newStatus,
                    lastRun: currentTime
                  };
                }
                return test;
              });

              // Update suite status based on all test results
              const hasFailedTests = updatedTests.some(test => test.status === 'failed');
              const newSuiteStatus: TestCase['status'] = hasFailedTests ? 'failed' : 'passed';
              
              return {
                ...suite,
                status: newSuiteStatus,
                lastRun: currentTime,
                tests: updatedTests
              };
            }
            return suite;
          })
        );

        // Show error message if test failed
        if (data.status === 'failed') {
          showError(data.message || 'Test failed');
        }

      } catch (fetchError) {
        // Handle fetch timeout or network errors
        console.error('Fetch error:', fetchError);
        setTestSuites(prevSuites => 
          prevSuites.map(suite => {
            if (suite.file === file) {
              const updatedTests = suite.tests.map(test => ({
                ...test,
                status: test.index === index ? ('failed' as const) : test.status,
                lastRun: test.index === index ? currentTime : test.lastRun
              }));

              // Update suite status if any test failed
              const hasFailedTests = updatedTests.some(test => test.status === 'failed');
              const newSuiteStatus: TestCase['status'] = hasFailedTests ? 'failed' : suite.status;

              return {
                ...suite,
                status: newSuiteStatus,
                lastRun: currentTime,
                tests: updatedTests
              };
            }
            return suite;
          })
        );
        
        showError(fetchError instanceof Error ? fetchError.message : 'Failed to run test');
      }

    } catch (error) {
      console.error('Error running test:', error);
      const currentTime = new Date().toISOString();
      
      // Update test status to failed and still update timestamp
      setTestSuites(prevSuites => 
        prevSuites.map(suite => {
          if (suite.file === file) {
            const updatedTests = suite.tests.map(test => ({
              ...test,
              status: test.index === index ? ('failed' as const) : test.status,
              lastRun: test.index === index ? currentTime : test.lastRun
            }));

            // Update suite status if any test failed
            const hasFailedTests = updatedTests.some(test => test.status === 'failed');
            const newSuiteStatus: TestCase['status'] = hasFailedTests ? 'failed' : suite.status;

            return {
              ...suite,
              status: newSuiteStatus,
              lastRun: currentTime,
              tests: updatedTests
            };
          }
          return suite;
        })
      );

      showError(error instanceof Error ? error.message : 'Failed to run test');
    } finally {
      setIsTestRunning(false);
    }
  };

  const parsePlaywrightOutput = (output: string) => {
    const results: Array<{ name: string; file: string; passed: boolean }> = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/\s+([✓✘])\s+\d+\s+(.+?):\d+:\d+\s+›\s+(.+?)\s+\(\d+ms\)/);
      if (match) {
        const [, status, filePath, testName] = match;
        results.push({
          name: testName.trim(),
          file: filePath.trim(),
          passed: status === '✓'
        });
      }
    }
    
    return results;
  };

  const handleRunAllTests = async (file: string) => {
    try {
      setIsTestRunning(true);
      const currentTime = new Date().toISOString();
      
      // Update UI to show all tests are running
      setTestSuites(prevSuites => 
        prevSuites.map(suite => {
          if (suite.file === file) {
            return {
              ...suite,
              status: 'running',
              lastRun: currentTime,
              tests: suite.tests.map(test => ({ 
                ...test, 
                status: 'running',
                lastRun: currentTime 
              }))
            };
          }
          return suite;
        })
      );

      // Set up timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        const response = await fetch('/api/run-all-tests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ file }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to run tests');
        }

        const data: TestResponse = await response.json();
        console.log('API Response:', data);
        
        // Update test statuses based on API response
        setTestSuites(prevSuites => 
          prevSuites.map(suite => {
            if (suite.file === file) {
              let updatedTests = suite.tests;

              // If we have specific test results
              if (data.testResults && data.testResults.length > 0) {
                // If there's only one generic "Test Execution" result, apply it to all tests
                if (data.testResults.length === 1 && data.testResults[0].testName === 'Test Execution') {
                  updatedTests = suite.tests.map(test => ({
                    ...test,
                    status: data.testResults[0].status,
                    lastRun: currentTime
                  }));
                } else {
                  // Otherwise, try to match individual test results
                  updatedTests = suite.tests.map(test => {
                    const testResult = data.testResults?.find(result => 
                      result.testName.toLowerCase() === test.name.toLowerCase()
                    );
                    
                    return {
                      ...test,
                      status: testResult ? testResult.status : 'failed',
                      lastRun: currentTime
                    };
                  });
                }
              } else {
                // If no test results, mark all as failed
                updatedTests = suite.tests.map(test => ({
                  ...test,
                  status: 'failed',
                  lastRun: currentTime
                }));
              }

              // Update suite status
              const suiteStatus = data.status === 'passed' ? 'passed' : 'failed';

              return {
                ...suite,
                status: suiteStatus,
                lastRun: currentTime,
                tests: updatedTests
              };
            }
            return suite;
          })
        );

        // Show error message if tests failed
        if (data.status === 'failed') {
          showError(data.message || 'Tests failed');
        }

      } catch (fetchError) {
        // Handle fetch timeout or network errors
        console.error('Fetch error:', fetchError);
        setTestSuites(prevSuites => 
          prevSuites.map(suite => {
            if (suite.file === file) {
              return {
                ...suite,
                status: 'failed',
                lastRun: currentTime,
                tests: suite.tests.map(test => ({
                  ...test,
                  status: 'failed',
                  lastRun: currentTime
                }))
              };
            }
            return suite;
          })
        );
        
        showError(fetchError instanceof Error ? fetchError.message : 'Failed to run tests');
      }

    } catch (error) {
      console.error('Error running all tests:', error);
      const currentTime = new Date().toISOString();
      
      // Update all tests to failed status
      setTestSuites(prevSuites => 
        prevSuites.map(suite => {
          if (suite.file === file) {
            return {
              ...suite,
              status: 'failed',
              lastRun: currentTime,
              tests: suite.tests.map(test => ({ 
                ...test, 
                status: 'failed',
                lastRun: currentTime 
              }))
            };
          }
          return suite;
        })
      );

      showError(error instanceof Error ? error.message : 'Failed to run tests');
    } finally {
      setIsTestRunning(false);
    }
  };

  const handleRunAllProjectTests = async () => {
    try {
      setIsTestRunning(true);
      setRunningAllTests(true);
      const currentTime = new Date().toISOString();
      
      // Mark all tests as running
      setTestSuites(prevSuites => prevSuites.map(suite => ({
        ...suite,
        status: 'running' as TestStatus,
        lastRun: currentTime,
        tests: suite.tests.map(test => ({
          ...test,
          status: 'running' as TestStatus,
          lastRun: currentTime
        }))
      })));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        const response = await fetch('/api/run-all-project-tests', {
          method: 'POST',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to run tests');
        }

        const data: TestResponse = await response.json();
        console.log('API Response:', data);
        
        // Update all test statuses based on results
        setTestSuites(prevSuites => {
          return prevSuites.map(suite => {
            // Get the base filename without path for matching
            const suiteFileName = suite.file.split('\\').pop() || suite.file;
            
            // Get results for this suite's file
            const suiteResults = data.testResults.filter(result => {
              // Get the base filename from the result file path
              const resultFileName = result.file;
              return resultFileName === suiteFileName;
            });
            
            // Update each test in the suite
            const updatedTests = suite.tests.map(test => {
              // Try to find a matching result
              const matchingResult = suiteResults.find(result => {
                const normalizedTestName = test.name.toLowerCase().replace(/\s+/g, ' ').trim();
                const normalizedResultName = result.testName.toLowerCase().replace(/\s+/g, ' ').trim();
                return normalizedTestName === normalizedResultName ||
                       normalizedResultName.includes(normalizedTestName) ||
                       normalizedTestName.includes(normalizedResultName);
              });

              if (matchingResult) {
                return {
                  ...test,
                  status: matchingResult.status as TestStatus,
                  lastRun: currentTime
                };
              } else {
                // If no matching result found, check if it's in a failed suite
                const isInFailedSuite = suiteResults.some(r => r.status === 'failed');
                return {
                  ...test,
                  // If the suite had any failures, mark pending tests as failed
                  status: (isInFailedSuite ? 'failed' : 'pending') as TestStatus,
                  lastRun: currentTime
                };
              }
            });

            // Determine suite status based on its tests
            const hasFailedTests = updatedTests.some(test => test.status === 'failed');
            const hasRunningTests = updatedTests.some(test => test.status === 'running');
            const hasPendingTests = updatedTests.some(test => test.status === 'pending');
            
            let suiteStatus: TestStatus;
            if (hasFailedTests) {
              suiteStatus = 'failed';
            } else if (hasRunningTests) {
              suiteStatus = 'running';
            } else if (hasPendingTests) {
              suiteStatus = 'pending';
            } else {
              suiteStatus = 'passed';
            }
            
            return {
              ...suite,
              status: suiteStatus,
              lastRun: currentTime,
              tests: updatedTests
            };
          });
        });

        // Show error message if tests failed
        if (data.status === 'failed') {
          showError(data.message || 'Some tests failed');
        }

      } catch (error) {
        console.error('Error running all project tests:', error);
        // Mark all running tests as failed
        setTestSuites(prevSuites => prevSuites.map(suite => ({
          ...suite,
          status: suite.status === 'running' ? 'failed' as TestStatus : suite.status,
          lastRun: currentTime,
          tests: suite.tests.map(test => ({
            ...test,
            status: test.status === 'running' ? 'failed' as TestStatus : test.status,
            lastRun: currentTime
          }))
        })));
        
        showError(error instanceof Error ? error.message : 'Failed to run tests');
      }

    } catch (error) {
      console.error('Error in handleRunAllProjectTests:', error);
      showError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setRunningAllTests(false);
      setIsTestRunning(false);
    }
  };

  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running': return <Loader className="h-5 w-5 animate-spin text-blue-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestCase['status']) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderTestRow = (test: TestCase) => {
    return (
      <div
        key={`${test.file}-${test.index}`}
        className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200"
      >
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            {getStatusIcon(test.status)}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{test.name}</h3>
            <p className="text-sm text-gray-500">{test.file}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`inline-flex items-center gap-x-1.5 rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(test.status)}`}>
            {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
          </span>
          <div className="text-sm text-gray-500 w-[180px] text-right whitespace-nowrap">
            <span className="text-gray-400 mr-1">Last Run:</span>
            <span className="tabular-nums">
              {test.lastRun ? new Date(test.lastRun).toLocaleString() : 'Never'}
            </span>
          </div>
          <button
            onClick={() => handleRunTest(test.file, test.index)}
            disabled={test.status === 'running'}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Play className="h-4 w-4" />
            Run Test
          </button>
        </div>
      </div>
    );
  };

  // Add search filter function
  const filteredTestSuites = useMemo(() => {
    let filtered = testSuites;

    // First apply search filter if query exists
    if (searchQuery.trim() && searchQuery.length >= 3) {
      const query = searchQuery.toLowerCase().trim();
      
      filtered = filtered.filter(suite => {
        const suiteFileMatches = hasConsecutiveMatch(suite.file, query);
        const hasMatchingTests = suite.tests.some(test => 
          hasConsecutiveMatch(test.name, query)
        );
        return suiteFileMatches || hasMatchingTests;
      }).map(suite => ({
        ...suite,
        tests: searchQuery ? suite.tests.filter(test =>
          hasConsecutiveMatch(test.name, query) ||
          hasConsecutiveMatch(suite.file, query)
        ) : suite.tests
      }));
    }

    // Then apply status filter if not 'all'
    if (statusFilter !== 'all') {
      filtered = filtered.filter(suite => {
        const hasMatchingTests = suite.tests.some(test => test.status === statusFilter);
        return hasMatchingTests;
      }).map(suite => ({
        ...suite,
        tests: suite.tests.filter(test => test.status === statusFilter)
      }));
    }

    return filtered;
  }, [testSuites, searchQuery, statusFilter]);

  console.log('Rendering interface, isLoading:', isLoading, 'error:', error, 'testSuites:', testSuites);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 p-8">
      {error && (
        <ErrorNotification
          message={error}
          onClose={() => setError(null)}
        />
      )}
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-blue-600">Test Runner Interface</h1>
              <p className="text-gray-600 mt-2">Manage and run your Playwright tests</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={fetchTests}
                disabled={isButtonsDisabled}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all duration-200 ${
                  isButtonsDisabled
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 pointer-events-none'
                    : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-200 hover:shadow-xl focus-visible:outline-blue-600'
                }`}
              >
                {isRefreshing ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Fetching Tests...
                  </>
                ) : (
                  <>
                    <RefreshCw className={`h-4 w-4 ${runningAllTests ? 'animate-spin' : ''}`} />
                    Get All Tests
                  </>
                )}
              </button>
              <button
                onClick={handleRunAllProjectTests}
                disabled={isButtonsDisabled}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all duration-200 ${
                  isButtonsDisabled
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 pointer-events-none'
                    : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-200 hover:shadow-xl focus-visible:outline-blue-600'
                }`}
              >
                {runningAllTests ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Running All Tests...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run All Project Tests
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Search and Filter Bar */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tests by name or file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-4 py-2.5 text-gray-900 border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TestStatus | 'all')}
                className="block w-48 pl-4 pr-10 py-2.5 text-gray-900 border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden ring-1 ring-gray-200">
          <div className="divide-y divide-gray-100">
            {filteredTestSuites.length > 0 ? (
              filteredTestSuites.map((suite) => (
                <div key={suite.file} className="group">
                  <div className="flex items-center justify-between p-4 hover:bg-blue-50/50 transition-all duration-200">
                    <div 
                      onClick={() => toggleSuite(suite.file)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer flex-grow"
                    >
                      <div className={`p-2 rounded-lg ${expandedSuites.has(suite.file) ? 'bg-blue-100' : 'bg-gray-100'} transition-colors duration-200`}>
                        {expandedSuites.has(suite.file) ? (
                          <ChevronDown className="h-5 w-5 text-blue-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{suite.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{suite.file}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center justify-between gap-4 min-w-[300px]">
                        <StatusBadge status={suite.status} />
                        <div className="text-xs text-gray-500 w-[200px] text-right whitespace-nowrap">
                          <span className="text-gray-400 mr-1">Last Run:</span>
                          <span className="tabular-nums font-mono">
                            {suite.lastRun ? new Date(suite.lastRun).toLocaleString() : 'Never'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRunAllTests(suite.file)}
                        disabled={suite.status === 'running'}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg min-w-[120px] justify-center"
                      >
                        {suite.status === 'running' ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Run All Tests
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {expandedSuites.has(suite.file) && (
                    <div className="pl-14 pr-4 pb-4 space-y-3 animate-slideDown">
                      {suite.tests.map((test) => (
                        <div
                          key={`${test.file}-${test.index}`}
                          className="flex items-center justify-between p-4 rounded-xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-blue-200 transition-all duration-200"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <StatusIcon status={test.status} />
                            <div className="min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">{test.name}</h4>
                              <p className="text-sm text-gray-500 truncate">{test.file}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex items-center justify-between gap-4 min-w-[300px]">
                              <StatusBadge status={test.status} />
                              <div className="text-xs text-gray-500 w-[200px] text-right whitespace-nowrap">
                                <span className="text-gray-400 mr-1">Last Run:</span>
                                <span className="tabular-nums font-mono">
                                  {test.lastRun ? new Date(test.lastRun).toLocaleString() : 'Never'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRunTest(test.file, test.index)}
                              disabled={test.status === 'running'}
                              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg min-w-[120px] justify-center"
                            >
                              {test.status === 'running' ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                              Run Test
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No tests found</h3>
                <p className="text-gray-500 max-w-sm">
                  No tests match your search query. Try adjusting your search or clear it to see all tests.
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-200"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'passed':
        return 'bg-green-50 text-green-700 ring-green-600/20';
      case 'failed':
        return 'bg-red-50 text-red-700 ring-red-600/20';
      case 'running':
        return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      default:
        return 'bg-gray-50 text-gray-600 ring-gray-500/20';
    }
  };

  return (
    <span className={`inline-flex items-center gap-x-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${getStatusColor(status)} min-w-[100px] justify-center`}>
      <StatusIcon status={status} className="h-4 w-4" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const StatusIcon = ({ status, className = "h-8 w-8" }: { status: string; className?: string }) => {
  switch (status.toLowerCase()) {
    case 'passed':
      return <CheckCircle className={`${className} text-green-600`} />;
    case 'failed':
      return <XCircle className={`${className} text-red-600`} />;
    case 'running':
      return <Loader className={`${className} text-blue-600 animate-spin`} />;
    default:
      return <Clock className={`${className} text-gray-400`} />;
  }
};

// Add this to your CSS file or styles
const styles = `
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideDown {
  animation: slideDown 0.2s ease-out;
}
`; 