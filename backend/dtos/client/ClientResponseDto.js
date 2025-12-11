// dtos/client/ClientResponseDTO.js
class ClientResponseDto {
  constructor(client) {
    this.id = client.id;
    this.accountNumber = client.accountNumber;
    this.firstName = client.firstName;
    this.lastName = client.lastName;
    this.email = client.email;
    this.phone = client.phone;
    this.secondaryPhone = client.secondaryPhone;
    this.dateOfBirth = client.dateOfBirth;
    this.gender = client.gender;
    this.occupation = client.occupation;
    this.employer = client.employer;
    this.monthlyIncome = client.monthlyIncome;
    this.address = client.address;
    this.preferredContactMethod = client.preferredContactMethod;
    this.isActive = client.isActive;
    this.status = client.status;
    this.createdAt = client.createdAt;
    this.updatedAt = client.updatedAt;
  }
}

module.exports = ClientResponseDto;
