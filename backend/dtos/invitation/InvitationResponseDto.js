class InvitationResponseDto {
  constructor(invitation) {
    this.id = invitation.id;
    this.email = invitation.email;
    this.first_name = invitation.firstName;
    this.middle_name = invitation.middleName;
    this.last_name = invitation.lastName;
    this.phone = invitation.phone;
    this.role = invitation.roleId;
    this.role_name = invitation.role?.name || null;
    this.status = invitation.status;
    this.expires_at = invitation.expiresAt;
    this.accepted_at = invitation.acceptedAt;
    this.revoked_at = invitation.revokedAt;
    this.invited_by = invitation.invitedBy;
    this.created_user_id = invitation.createdUserId;
    this.created_at = invitation.created_at;
  }
}

module.exports = InvitationResponseDto;
