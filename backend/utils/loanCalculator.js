function calculateMonthlyPayment(principal, interestRate, termMonths, interestType = 'reducing') {
  const P = Number(principal);
  const r = Number(interestRate) / 100 / 12;
  const n = Number(termMonths);

  if (!P || !n) return null;

  if (interestRate === 0 || !r) {
    return (P / n).toFixed(2);
  }

  if (interestType === 'flat') {
    const totalInterest = P * (interestRate / 100) * (n / 12);
    return ((P + totalInterest) / n).toFixed(2);
  }

  return (P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)).toFixed(2);
}

/**
 * Generates a complete amortization schedule for a loan
 * @param {Object} options - Loan parameters
 * @param {number} options.principal - Principal loan amount
 * @param {number} options.interestRate - Annual interest rate (percentage)
 * @param {number} options.termMonths - Loan term in months
 * @param {string} options.interestType - 'reducing' or 'flat'
 * @param {Date|string} options.startDate - Loan disbursement date
 * @param {string} options.paymentFrequency - 'monthly', 'bi-weekly', 'weekly', 'quarterly'
 * @returns {Array} Array of installment objects
 */
function generateAmortizationSchedule(options) {
  const {
    principal,
    interestRate,
    termMonths,
    interestType = 'reducing',
    startDate,
    paymentFrequency = 'monthly'
  } = options;

  const P = parseFloat(principal);
  const annualRate = parseFloat(interestRate) / 100;
  const monthlyRate = annualRate / 12;
  const n = parseInt(termMonths, 10);

  if (!P || !n) {
    throw new Error('Invalid principal or term');
  }

  const schedule = [];
  let remainingBalance = P;
  const disbursementDate = new Date(startDate);

  // Calculate payment frequency multiplier
  const frequencyMap = {
    monthly: { periods: n, daysIncrement: 30 },
    'bi-weekly': { periods: n * 2, daysIncrement: 14 },
    weekly: { periods: n * 4, daysIncrement: 7 },
    quarterly: { periods: Math.ceil(n / 3), daysIncrement: 90 }
  };

  const frequency = frequencyMap[paymentFrequency] || frequencyMap.monthly;

  if (interestType === 'flat') {
    // Flat interest: Total interest calculated upfront and divided equally
    const totalInterest = P * annualRate * (n / 12);
    const totalAmount = P + totalInterest;
    const installmentAmount = totalAmount / n;
    const principalPerInstallment = P / n;
    const interestPerInstallment = totalInterest / n;

    for (let i = 1; i <= n; i++) {
      const dueDate = new Date(disbursementDate);
      dueDate.setDate(dueDate.getDate() + (i * frequency.daysIncrement));

      remainingBalance -= principalPerInstallment;

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        principalAmount: parseFloat(principalPerInstallment.toFixed(2)),
        interestAmount: parseFloat(interestPerInstallment.toFixed(2)),
        totalAmount: parseFloat(installmentAmount.toFixed(2)),
        remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2))
      });
    }
  } else {
    // Reducing balance: Interest calculated on remaining balance
    const monthlyPayment = parseFloat(calculateMonthlyPayment(P, interestRate, n, 'reducing'));

    for (let i = 1; i <= n; i++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;

      const dueDate = new Date(disbursementDate);
      dueDate.setDate(dueDate.getDate() + (i * frequency.daysIncrement));

      remainingBalance -= principalPayment;

      // Handle last payment rounding issues
      const isLastPayment = i === n;
      const finalPrincipal = isLastPayment ? principalPayment + remainingBalance : principalPayment;
      const finalRemaining = isLastPayment ? 0 : remainingBalance;

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        principalAmount: parseFloat(finalPrincipal.toFixed(2)),
        interestAmount: parseFloat(interestPayment.toFixed(2)),
        totalAmount: parseFloat((finalPrincipal + interestPayment).toFixed(2)),
        remainingBalance: parseFloat(Math.max(0, finalRemaining).toFixed(2))
      });

      if (isLastPayment) {
        remainingBalance = 0;
      }
    }
  }

  return schedule;
}

/**
 * Calculate total interest for a loan
 * @param {number} principal - Principal amount
 * @param {number} interestRate - Annual interest rate (percentage)
 * @param {number} termMonths - Term in months
 * @param {string} interestType - 'reducing' or 'flat'
 * @returns {number} Total interest amount
 */
function calculateTotalInterest(principal, interestRate, termMonths, interestType = 'reducing') {
  const schedule = generateAmortizationSchedule({
    principal,
    interestRate,
    termMonths,
    interestType,
    startDate: new Date()
  });

  return schedule.reduce((sum, installment) => sum + installment.interestAmount, 0);
}

module.exports = {
  calculateMonthlyPayment,
  generateAmortizationSchedule,
  calculateTotalInterest
};
