const Loan = require('../models/loanModel');

function calculateMonthlyPayment(amount, interestRate, repaymentMonths) {
  if (!amount || !interestRate || !repaymentMonths) return null;

  // monthly rate
  const principal = parseFloat(amount);
  const rate = parseFloat(interestRate) / 100 / 12; 
  const months = parseInt(repaymentMonths, 10);

  // Avoid division by zero
  if (rate === 0) return (principal / months).toFixed(2);

  const monthlyPayment = principal * (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
  return monthlyPayment.toFixed(2);
}

const loanService = {
  async getAllLoans() {
    return await Loan.findAll();
  },

  async getLoanById(id) {
    const loan = await Loan.findByPk(id);
    if (!loan) throw new Error('Loan not found');
    return loan;
  },

  async createLoan(data) {
    // Auto-calculate monthly payment before saving
    if (data.amount && data.interest_rate && data.repayment_months) {
      data.monthly_payment = calculateMonthlyPayment(data.amount, data.interest_rate, data.repayment_months);
    }

    const newLoan = await Loan.create(data);
    return newLoan;
  },

  async updateLoan(id, data) {
    const loan = await Loan.findByPk(id);
    if (!loan) throw new Error('Loan not found');

    // Recalculate if loan financial details are changed
    if (data.amount || data.interest_rate || data.repayment_months) {
      const amount = data.amount || loan.amount;
      const rate = data.interest_rate || loan.interest_rate;
      const months = data.repayment_months || loan.repayment_months;

      data.monthly_payment = calculateMonthlyPayment(amount, rate, months);
    }

    await loan.update(data);
    return loan;
  },

  async deleteLoan(id) {
    const loan = await Loan.findByPk(id);
    if (!loan) throw new Error('Loan not found');
    await loan.destroy();
    return loan;
  },
};

module.exports = loanService;
