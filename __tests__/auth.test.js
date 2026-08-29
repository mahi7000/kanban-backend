/**
 * Auth Routes — Integration Tests
 *
 * Uses supertest to test API endpoints without a running server.
 * Supabase calls are mocked to isolate the Express layer.
 */

const request = require('supertest');
const app = require('../src/app');

// ─────────────────────────────────────────────────────────────────────────────
// Mock Supabase clients so tests don't hit the real DB
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('../src/config/supabase', () => {
  const mockAuth = {
    admin: {
      createUser: jest.fn(),
      listUsers: jest.fn(),
      getUserById: jest.fn(),
    },
    signInWithPassword: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    getUser: jest.fn(),
  };

  const mockClient = {
    auth: mockAuth,
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
  };

  return { supabase: mockClient, supabaseAdmin: mockClient };
});

jest.mock('../src/config/email', () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }) },
  verifyEmailConnection: jest.fn().mockResolvedValue(true),
}));

const { supabaseAdmin } = require('../src/config/supabase');

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 201 for valid registration', async () => {
    supabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'uuid-1', email: 'test@example.com' } },
      error: null,
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Password1', full_name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('should return 422 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'Password1' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('should return 422 for weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'weak' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('should return 409 if email already registered', async () => {
    supabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existing@example.com', password: 'Password1' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 and tokens on valid login', async () => {
    supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'uuid-1', email: 'test@example.com', user_metadata: {} },
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: 9999999999,
        },
      },
      error: null,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
  });

  it('should return 401 for invalid credentials', async () => {
    supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return user profile with a valid token', async () => {
    const fakeUser = {
      id: 'uuid-1',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
      created_at: new Date().toISOString(),
    };
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: fakeUser }, error: null });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('should always return 200 regardless of email existence', async () => {
    supabaseAdmin.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'any@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
