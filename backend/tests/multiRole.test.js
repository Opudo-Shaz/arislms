const test = require('node:test');
const assert = require('node:assert/strict');

const { isAdmin, isLimitedOnly, hasBuiltInRole } = require('../utils/helpers');
const { normalizeRoleIds } = require('../utils/userRoles');
const { validateSync } = require('../utils/validationMiddleware');
const UserRequestDto = require('../dtos/user/UserRequestDto');
const InvitationRequestDto = require('../dtos/invitation/InvitationRequestDto');
const UserResponseDto = require('../dtos/user/UserResponseDto');

test('isAdmin accepts a single role or any-of an array of roles', () => {
  assert.equal(isAdmin(1), true);
  assert.equal(isAdmin([3, 4]), false);
  assert.equal(isAdmin([3, 2]), true);
  assert.equal(isAdmin([1]), true);
  assert.equal(isAdmin([]), false);
  assert.equal(isAdmin(undefined), false);
});

test('isLimitedOnly / hasBuiltInRole consider every role the user holds', () => {
  assert.equal(isLimitedOnly([3, 5]), true);
  assert.equal(isLimitedOnly([3, 2]), false);
  assert.equal(isLimitedOnly([5]), false);
  assert.equal(hasBuiltInRole([5, 3]), true);
  assert.equal(hasBuiltInRole([5, 6]), false);
});

test('normalizeRoleIds dedupes and coerces ids', () => {
  assert.deepEqual(normalizeRoleIds(['2', 2, 4]), [2, 4]);
  assert.deepEqual(normalizeRoleIds(undefined), []);
  assert.deepEqual(normalizeRoleIds(3), [3]);
});

const baseUser = {
  first_name: 'Alice',
  last_name: 'Smith',
  email: 'alice@test.com',
  phone: '254712345678',
  password: 'Password123!',
};

test('user create schema requires a non-empty unique roles array', () => {
  assert.equal(validateSync({ ...baseUser, roles: [2, 4] }, UserRequestDto.createSchema).valid, true);
  assert.equal(validateSync({ ...baseUser }, UserRequestDto.createSchema).valid, false);
  assert.equal(validateSync({ ...baseUser, roles: [] }, UserRequestDto.createSchema).valid, false);
  assert.equal(validateSync({ ...baseUser, roles: [2, 2] }, UserRequestDto.createSchema).valid, false);
});

test('user update schema allows omitting roles', () => {
  assert.equal(validateSync({ first_name: 'Alicia' }, UserRequestDto.updateSchema).valid, true);
  assert.equal(validateSync({ roles: [1, 4] }, UserRequestDto.updateSchema).valid, true);
});

test('invitation create schema takes roles[]', () => {
  const payload = { email: 'a@test.com', first_name: 'Al' };
  assert.equal(validateSync({ ...payload, roles: [2, 4] }, InvitationRequestDto.createSchema).valid, true);
  assert.equal(validateSync(payload, InvitationRequestDto.createSchema).valid, false);
});

test('UserResponseDto exposes roles', () => {
  assert.deepEqual(new UserResponseDto({ id: 1, roleIds: [2, 4] }).roles, [2, 4]);
  assert.deepEqual(new UserResponseDto({ id: 1 }).roles, []);
});
