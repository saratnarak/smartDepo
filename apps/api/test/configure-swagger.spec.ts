import { isSwaggerEnabled } from '../src/common/bootstrap/configure-swagger.js';

describe('isSwaggerEnabled', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSwaggerEnabled = process.env.SWAGGER_ENABLED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSwaggerEnabled === undefined) {
      delete process.env.SWAGGER_ENABLED;
    } else {
      process.env.SWAGGER_ENABLED = originalSwaggerEnabled;
    }
  });

  it('is enabled outside production by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SWAGGER_ENABLED;

    expect(isSwaggerEnabled()).toBe(true);
  });

  it('is disabled in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SWAGGER_ENABLED;

    expect(isSwaggerEnabled()).toBe(false);

    process.env.SWAGGER_ENABLED = 'true';
    expect(isSwaggerEnabled()).toBe(true);
  });

  it('can be disabled in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.SWAGGER_ENABLED = 'false';

    expect(isSwaggerEnabled()).toBe(false);
  });
});
