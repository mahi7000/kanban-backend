/**
 * Project Routes — Integration Tests
 */

const request = require('supertest');
const app = require('../src/app');

// ── Shared mock user ──────────────────────────────────────────────────────────
const mockUser = {
  id: 'user-uuid-1',
  email: 'owner@example.com',
  user_metadata: { full_name: 'Project Owner' },
};

const mockProject = {
  id: 'project-uuid-1',
  name: 'Test Project',
  description: 'A test project',
  owner_id: mockUser.id,
  status: 'active',
  settings: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../src/config/supabase', () => {
  const mockFn = () => jest.fn();
  const chainMock = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  };

  const mockAuth = {
    admin: {
      createUser: jest.fn(),
      listUsers: jest.fn(),
      getUserById: jest.fn(),
    },
    signInWithPassword: jest.fn(),
    getUser: jest.fn(),
    resetPasswordForEmail: jest.fn(),
  };

  return {
    supabase: { auth: mockAuth, from: jest.fn(() => ({ ...chainMock })) },
    supabaseAdmin: { auth: mockAuth, from: jest.fn(() => ({ ...chainMock })) },
  };
});

jest.mock('../src/config/email', () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }) },
  verifyEmailConnection: jest.fn().mockResolvedValue(true),
}));

const { supabaseAdmin } = require('../src/config/supabase');

// Helper: mock authentication middleware
const mockAuthenticate = (user = mockUser) => {
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user }, error: null });
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticate();
  });

  it('should return 200 and projects list', async () => {
    // Mock owned projects query
    supabaseAdmin.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      // Simulates chained resolution
      then: jest.fn(resolve => resolve({ data: [mockProject], error: null, count: 1 })),
    }));

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticate();
  });

  it('should return 422 when name is missing', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer valid-token')
      .send({ description: 'No name' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('should return 422 for invalid status value', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'My Project', status: 'invalid-status' });

    expect(res.status).toBe(422);
  });
});
