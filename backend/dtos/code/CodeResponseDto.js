const CodeValueResponseDto = require('../codeValue/CodeValueResponseDto');

class CodeResponseDto {
  constructor(code) {
    this.id = code.id;
    this.key = code.key;
    this.name = code.name;
    this.description = code.description;
    this.isActive = code.isActive;
    this.createdBy = code.createdBy;
    this.modifiedBy = code.modifiedBy;
    this.modifiedAt = code.modifiedAt;
    this.createdAt = code.createdAt;
    this.updatedAt = code.updatedAt;

    // Include values only when eager-loaded
    const values = code.values ?? code.get?.('values');
    if (values) {
      this.values = CodeValueResponseDto.fromModels(values);
    }
  }

  static fromModel(code) {
    if (!code) return null;
    return new CodeResponseDto(code);
  }

  static fromModels(codes) {
    if (!codes || !Array.isArray(codes)) return [];
    return codes.map((code) => new CodeResponseDto(code));
  }
}

module.exports = CodeResponseDto;
