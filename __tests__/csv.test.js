/**
 * CSV Service Unit Tests
 */

const { parseCsvBuffer } = require('../src/services/csv.service');

const VALID_CSV = `Week,Day,Date,Assignee,Email,Side,Status,Title,Epic,Priority,EstimateHours,Repo,Branch,Dependencies,Goal,FullPrompt
1,1 (Jul 22),Jul 22,Hiwot,hiwot@example.com,FE,To do,Shared UI component library,Foundation,High,6,marketplace-web,chore/ui-components,React app skeleton,Build reusable components,Implement this story
2,2 (Jul 23),Jul 23,Abel,abel@example.com,BE,In Progress,User auth API,Auth,Medium,4,marketplace-api,feat/auth,,Implement JWT auth,Build auth endpoints`;

const INVALID_CSV = `Week,Day,Date,Assignee,Email,Side,Status,Title,Epic,Priority,EstimateHours,Repo,Branch,Dependencies,Goal,FullPrompt
1,Mon,Jul 22,Hiwot,hiwot@example.com,FE,Todo,,Foundation,High,6,repo,branch,,Goal,Prompt`;

describe('CSV Service', () => {
  const BOARD_ID = 'board-uuid-1';
  const USER_ID = 'user-uuid-1';

  it('should parse valid CSV and return task objects', async () => {
    const buffer = Buffer.from(VALID_CSV);
    const { valid, invalid, total } = await parseCsvBuffer(buffer, BOARD_ID, USER_ID);

    expect(total).toBe(2);
    expect(valid).toHaveLength(2);
    expect(invalid).toHaveLength(0);

    const firstTask = valid[0];
    expect(firstTask.title).toBe('Shared UI component library');
    expect(firstTask.status).toBe('todo');
    expect(firstTask.priority).toBe('high');
    expect(firstTask.board_id).toBe(BOARD_ID);
    expect(firstTask.created_by).toBe(USER_ID);
    expect(firstTask.estimate_hours).toBe(6);
  });

  it('should map "In Progress" status correctly', async () => {
    const buffer = Buffer.from(VALID_CSV);
    const { valid } = await parseCsvBuffer(buffer, BOARD_ID, USER_ID);
    expect(valid[1].status).toBe('in_progress');
  });

  it('should mark rows with missing title as invalid', async () => {
    const buffer = Buffer.from(INVALID_CSV);
    const { valid, invalid, total } = await parseCsvBuffer(buffer, BOARD_ID, USER_ID);

    expect(total).toBe(1);
    expect(invalid).toHaveLength(1);
    expect(valid).toHaveLength(0);
    expect(invalid[0].errors).toContain('Title is required');
  });

  it('should return empty arrays for empty CSV (header only)', async () => {
    const headerOnly = `Week,Day,Date,Assignee,Email,Side,Status,Title,Epic,Priority,EstimateHours,Repo,Branch,Dependencies,Goal,FullPrompt`;
    const buffer = Buffer.from(headerOnly);
    const { valid, invalid, total } = await parseCsvBuffer(buffer, BOARD_ID, USER_ID);

    expect(total).toBe(0);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });

  it('should store assignee name and email in metadata', async () => {
    const buffer = Buffer.from(VALID_CSV);
    const { valid } = await parseCsvBuffer(buffer, BOARD_ID, USER_ID);

    expect(valid[0].metadata.assignee_name).toBe('Hiwot');
    expect(valid[0].metadata.assignee_email).toBe('hiwot@example.com');
  });
});
