const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const usersRepo = require('../repositories/users.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const {
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
  VersionConflictError,
  DuplicateError,
  NotFoundError,
} = require('../utils/errors');
const { mapUser } = require('../db/mappers');
const { ROLES } = require('@stockflow/shared');

async function login(username, password) {
  const normUsername = username.trim().toLowerCase();
  const user = await usersRepo.findByUsername(normUsername);

  // Return identical generic error for non-existent user or invalid password
  if (!user) {
    throw UnauthorizedError('Invalid username or password');
  }

  if (!user.isActive) {
    throw UnauthorizedError('Account is disabled');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw UnauthorizedError('Invalid username or password');
  }

  const token = jwt.sign(
    { userId: user.id },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN || '30d' }
  );

  return {
    token,
    user: mapUser(user),
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await usersRepo.findById(userId);
  if (!user) {
    throw NotFoundError('User not found');
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw UnauthorizedError('Current password does not match');
  }

  const passwordHash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS || 12);

  await withTransaction(async (tx) => {
    await usersRepo.updateUser(userId, { passwordHash, updatedBy: userId }, tx);
    const revision = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId,
      action: 'CHANGE_PASSWORD',
      entity: 'users',
      entityId: userId,
    }, tx);
    return revision;
  });

  return { success: true };
}

async function listUsers() {
  const users = await usersRepo.listUsers();
  return users.map(mapUser);
}

async function createUser(actorId, { username, password, role, color }) {
  const normUsername = username.trim().toLowerCase();
  const existing = await usersRepo.findByUsername(normUsername);
  if (existing) {
    throw DuplicateError(`Username '${normUsername}' is already taken`);
  }

  const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS || 12);

  const { user, revision } = await withTransaction(async (tx) => {
    const created = await usersRepo.createUser({
      username: normUsername,
      passwordHash,
      role: role || ROLES.STAFF,
      color,
      createdBy: actorId,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'CREATE',
      entity: 'users',
      entityId: created.id,
      after: mapUser(created),
    }, tx);

    return { user: created, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'users',
    by: actorId,
  });

  return mapUser(user);
}

async function updateUser(actorId, id, data) {
  const user = await usersRepo.findById(id);
  if (!user) {
    throw NotFoundError('User not found');
  }

  if (data.version !== undefined && user.version !== data.version) {
    throw VersionConflictError('User was modified by another transaction. Please reload.');
  }

  // Guard: Last active admin cannot be disabled or demoted
  if (user.role === ROLES.ADMIN) {
    const isDemoting = data.role && data.role !== ROLES.ADMIN;
    const isDisabling = data.isActive === false;
    if (isDemoting || isDisabling) {
      const activeAdminCount = await usersRepo.countActiveAdmins();
      if (activeAdminCount <= 1) {
        throw ForbiddenError('Cannot demote or disable the last active administrator');
      }
    }
  }

  const { updated, revision } = await withTransaction(async (tx) => {
    const res = await usersRepo.updateUser(id, {
      ...(data.role ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.color ? { color: data.color } : {}),
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'UPDATE',
      entity: 'users',
      entityId: id,
      before: mapUser(user),
      after: mapUser(res),
    }, tx);

    return { updated: res, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'users',
    by: actorId,
  });

  return mapUser(updated);
}

async function resetPassword(actorId, id, newPassword) {
  const user = await usersRepo.findById(id);
  if (!user) {
    throw NotFoundError('User not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS || 12);

  const revision = await withTransaction(async (tx) => {
    await usersRepo.updateUser(id, { passwordHash, updatedBy: actorId }, tx);
    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'RESET_PASSWORD',
      entity: 'users',
      entityId: id,
    }, tx);
    return rev;
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'users',
    by: actorId,
  });

  return { success: true };
}

module.exports = {
  login,
  changePassword,
  listUsers,
  createUser,
  updateUser,
  resetPassword,
};

