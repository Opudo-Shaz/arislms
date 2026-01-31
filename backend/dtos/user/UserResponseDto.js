class UserResponseDto {
  constructor(user) {
    this.id = user.id;
    this.first_name = user.first_name;
    this.middle_name = user.middle_name;
    this.last_name = user.last_name;
    this.email = user.email;
    this.phone = user.phone;
    this.role = user.role_id;
    this.created_at = user.created_at;
  }
}

module.exports = UserResponseDto;
