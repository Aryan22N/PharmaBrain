const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const users = await pool.query('SELECT id, name, email, role, "patientId", "doctorId" FROM "User" ORDER BY id DESC LIMIT 10');
  console.log('RECENT USERS:\n', JSON.stringify(users.rows, null, 2));

  const requests = await pool.query('SELECT * FROM patient_access_requests ORDER BY id DESC LIMIT 10');
  console.log('RECENT ACCESS REQUESTS:\n', JSON.stringify(requests.rows, null, 2));

  const docs = await pool.query('SELECT id, "userId", "patientId", "originalName", status, "uploadedAt" FROM "Document" ORDER BY id DESC LIMIT 10');
  console.log('RECENT DOCS:\n', JSON.stringify(docs.rows, null, 2));

  await pool.end();
}
check().catch(console.error);
