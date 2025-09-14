// Test file to verify linting catches SQL formatting issues
const badSql = `
  SELECT "id", "status", "origkey"
  FROM "Photo"
  WHERE "status" = 'PENDING'
`;

const goodSql = `
  SELECT id, status, origkey
  FROM photo
  WHERE status = 'PENDING'
`;

export { badSql, goodSql };
