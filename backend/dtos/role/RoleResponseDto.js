class RoleResponseDto {
  constructor(role) {
    this.id = role.id;
    this.name = role.name;
    this.description = role.description;
    this.permissions = role.permissions || [];
    this.isActive = role.isActive;
    this.createdBy = role.createdBy;
    this.createdAt = role.createdAt;
    this.updatedAt = role.updatedAt;
  }

  static fromModel(role) {
    if (!role) return null;
    return new RoleResponseDto(role);
  }

  static fromModels(roles) {
    if (!roles || !Array.isArray(roles)) return [];
    return roles.map(role => new RoleResponseDto(role));
  }
}

module.exports = RoleResponseDto;
