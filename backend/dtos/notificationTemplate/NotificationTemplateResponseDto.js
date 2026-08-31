class NotificationTemplateResponseDto {
  constructor(template) {
    this.id = template.id;
    this.eventKey = template.eventKey;
    this.description = template.description;
    this.emailSubject = template.emailSubject;
    this.emailBody = template.emailBody;
    this.smsBody = template.smsBody;
    this.pushTitle = template.pushTitle;
    this.pushBody = template.pushBody;
    this.inAppTitle = template.inAppTitle;
    this.inAppBody = template.inAppBody;
    this.emailEnabled = template.emailEnabled;
    this.smsEnabled = template.smsEnabled;
    this.pushEnabled = template.pushEnabled;
    this.inAppEnabled = template.inAppEnabled;
    this.isActive = template.isActive;
    this.createdBy = template.createdBy;
    this.modifiedBy = template.modifiedBy;
    this.createdAt = template.createdAt;
    this.updatedAt = template.updatedAt;
  }

  static fromModel(template) {
    if (!template) return null;
    return new NotificationTemplateResponseDto(template);
  }

  static fromModels(templates) {
    if (!templates || !Array.isArray(templates)) return [];
    return templates.map((t) => new NotificationTemplateResponseDto(t));
  }
}

module.exports = NotificationTemplateResponseDto;
