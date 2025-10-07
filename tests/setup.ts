// This file can be used to set up your test environment.
// For example, you can add polyfills or global mocks here.

import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './__mocks__/server';
import '@testing-library/jest-dom';

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers());

// Clean up after all tests are done
afterAll(() => server.close());
