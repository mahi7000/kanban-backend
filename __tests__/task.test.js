/**
 * Task Routes — Integration Tests
 */

const request = require('supertest');
const app = require('../src/app');

jest.mock('../src/config/supabase', () => {
  const mockAuth = {
    admin: { createUser: jest.fn(), listUsers: jest.fn(), getUserById: jest.fn() },
    signInWithPassword: jest.fn(),
    getUser: jest.fn(),
    resetPasswordForEmail: jest.fn(),
  };
  const buildChain = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  });
  const client = { auth: mockAuth, from: jest.fn(buildChain) };
  return { supabase: client, supabaseAdmin: client };
});

jest.mock('../src/config/email', () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({ messageId: 'x' }) },
  verifyEmailConnection: jest.fn(),
}));

const { supabaseAdmin } = require('../src/config/supabase');

const mockUser = { id: 'user-1', email: 'user@test.com', user_metadata: {} };

describe('Task Validators', () => {
  beforeEach(() => {
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  it('POST /api/boards/:boardId/tasks — 422 when title missing', async () => {
    const res = await request(app)
      .post('/api/boards/board-uuid-1/tasks')
      .set('Authorization', 'Bearer token')
      .send({ status: 'todo' }); // missing title

    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.field === 'title')).toBe(true);
  });

  it('POST /api/boards/:boardId/tasks — 422 for invalid status', async () => {
    const res = await request(app)
      .post('/api/boards/board-uuid-1/tasks')
      .set('Authorization', 'Bearer token')
      .send({ title: 'My task', status: 'bogus' });

    expect(res.status).toBe(422);
  });

  it('POST /api/boards/:boardId/tasks — 422 for invalid priority', async () => {
    const res = await request(app)
      .post('/api/boards/board-uuid-1/tasks')
      .set('Authorization', 'Bearer token')
      .send({ title: 'My task', status: 'todo', priority: 'super-urgent' });

    expect(res.status).toBe(422);
  });

  it('PATCH /api/tasks/:id/status — 422 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-uuid-1/status')
      .set('Authorization', 'Bearer token')
      .send({ status: 'maybe' });

    expect(res.status).toBe(422);
  });

  it('PATCH /api/tasks/:id/position — 422 for negative position', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-uuid-1/position')
      .set('Authorization', 'Bearer token')
      .send({ position: -1 });

    expect(res.status).toBe(422);
  });
});
