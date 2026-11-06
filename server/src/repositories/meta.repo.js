const { prisma } = require('../db');

async function getRevision(client = prisma) {
  const row = await client.meta.findUnique({
    where: { key: 'revision' },
  });
  return row ? parseInt(row.value, 10) : 0;
}

async function bumpRevision(client = prisma) {
  const current = await getRevision(client);
  const next = current + 1;
  await client.meta.upsert({
    where: { key: 'revision' },
    update: { value: String(next) },
    create: { key: 'revision', value: String(next) },
  });
  return next;
}

async function setRevision(nextRevision, client = prisma) {
  await client.meta.upsert({
    where: { key: 'revision' },
    update: { value: String(nextRevision) },
    create: { key: 'revision', value: String(nextRevision) },
  });
  return nextRevision;
}

module.exports = {
  getRevision,
  bumpRevision,
  setRevision,
};

