import type { NextPage } from 'next';
import { useEffect, useState, useCallback } from 'react';
import { Play, CheckCircle, XCircle, Loader, Clock } from 'lucide-react';

interface TestCase {
  id: string;
  name: string;
  description: string;
  filename: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  lastRun?: string | null;
}

const PlaywrightRunnerUI: NextPage = () => {
  const [tests, setTests] = useState<TestCase[]>([]);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/list-tests')
      .then(res => res.json())
      .then(data => setTests(data.tests));
  }, []);

  const handleRunTest = useCallback(async (testId: string) => {
    const testToRun = tests.find(test => test.id === testId);
    if (!testToRun) return;

    setRunningTestId(testId);
    setTests(prev =>
      prev.map(test => (test.id === testId ? { ...test, status: 'running' } : test))
    );

    try {
      const response = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPath: testToRun.filename }),
      });

      const data = await response.json();
      const newStatus = data.status === 'passed' ? 'passed' : 'failed';

      setTests(prev =>
        prev.map(test =>
          test.id === testId
            ? { ...test, status: newStatus, lastRun: new Date().toLocaleString() }
            : test
        )
      );
    } catch (err) {
      setTests(prev =>
        prev.map(test =>
          test.id === testId
            ? { ...test, status: 'failed', lastRun: new Date().toLocaleString() }
            : test
        )
      );
    } finally {
      setRunningTestId(null);
    }
  }, [tests]);

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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="container mx-auto px-4 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold">Playwright Test Runner</h1>
          <p className="mt-2 text-lg text-gray-600">View and run automated tests with ease.</p>
        </header>
        <main>
          <div className="rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Test Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Last Run</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map(test => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{test.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{test.description}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(test.status)}`}>
                        {getStatusIcon(test.status)}
                        {test.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{test.lastRun || 'Never'}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleRunTest(test.id)}
                        disabled={runningTestId !== null}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md ${runningTestId !== null ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      >
                        <Play className="inline h-4 w-4 mr-1" /> Run Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PlaywrightRunnerUI;
