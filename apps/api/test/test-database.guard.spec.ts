import { getTestDatabaseUrl } from './support/test-database.js';

describe('test database guard', () => {
  const original = process.env.TEST_DATABASE_URL;
  const base = 'postgresql://user:password@localhost:5432';

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = original;
    }
  });

  it('accepts a database whose name ends with _test', () => {
    process.env.TEST_DATABASE_URL = `${base}/smartdepo_test?schema=public`;
    expect(getTestDatabaseUrl()).toBe(`${base}/smartdepo_test?schema=public`);
  });

  it('refuses a database that does not end with _test', () => {
    process.env.TEST_DATABASE_URL = `${base}/smartdepo?schema=public`;
    expect(() => getTestDatabaseUrl()).toThrow(/does not end with _test/);
  });

  it('refuses when TEST_DATABASE_URL is missing', () => {
    delete process.env.TEST_DATABASE_URL;
    expect(() => getTestDatabaseUrl()).toThrow(/TEST_DATABASE_URL is not set/);
  });
});
