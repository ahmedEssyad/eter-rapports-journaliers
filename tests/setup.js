// tests/setup.js
// Configuration globale pour les tests

// Variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-eter-testing';
process.env.MONGODB_URI = 'mongodb://localhost:27017/eter_test';

// Timeout global pour les tests
jest.setTimeout(10000);

// Mock console pour éviter les logs pendant les tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Nettoyage après chaque test
afterEach(() => {
  jest.clearAllMocks();
});
