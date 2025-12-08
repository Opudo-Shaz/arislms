// dtos/user/UserResponseDTO.js
class UserResponseDTO {
  constructor(user) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.phone = user.phone;
    this.role = user.role;
    this.group_code = user.group_code;
    this.created_at = user.created_at;
  }
}

module.exports = UserResponseDTO;
