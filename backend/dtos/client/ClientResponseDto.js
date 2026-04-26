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
    this.kycStatus = client.kycStatus;
    this.kycVerifiedAt = client.kycVerifiedAt;
    this.kycNotes = client.kycNotes;
    this.verifiedBy = client.verifiedBy;
    this.createdAt = client.createdAt;
    this.updatedAt = client.updatedAt;

    // Include latest credit score if loaded via association
    const scores = client.creditScores;
    this.creditScore = scores && scores.length > 0 ? scores[0] : null;
  }
}

module.exports = ClientResponseDto;
