class CodeValueResponseDto {
  constructor(codeValue) {
    this.id = codeValue.id;
    this.codeId = codeValue.codeId;
    this.value = codeValue.value;
    this.description = codeValue.description;
    this.sortOrder = codeValue.sortOrder;
    this.isActive = codeValue.isActive;
    this.createdBy = codeValue.createdBy;
    this.modifiedBy = codeValue.modifiedBy;
    this.modifiedAt = codeValue.modifiedAt;
    this.createdAt = codeValue.createdAt;
    this.updatedAt = codeValue.updatedAt;
  }

  static fromModel(codeValue) {
    if (!codeValue) return null;
    return new CodeValueResponseDto(codeValue);
  }

  static fromModels(codeValues) {
    if (!codeValues || !Array.isArray(codeValues)) return [];
    return codeValues.map((codeValue) => new CodeValueResponseDto(codeValue));
  }
}

module.exports = CodeValueResponseDto;
