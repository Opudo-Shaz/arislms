class AdminUserDTO {
  constructor(user) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.phone = user.phone;
    this.role = user.role;
    this.group_code = user.group_code;
    this.id_number = user.id_number;
    this.created_at = user.created_at;
  }
}

module.exports = AdminUserDTO;
