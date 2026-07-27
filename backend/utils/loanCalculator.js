/**
 * Converts a periodic interest rate into the effective monthly rate used for
 * amortization math, based on how the rate is expressed on the loan/product.
 * @param {number} interestRate - Interest rate (percentage)
 * @param {string} interestRatePeriod - 'monthly' or 'annual' (default 'annual')
 * @returns {number} Monthly rate as a decimal (e.g. 0.015 for 1.5%)
 */
function toMonthlyRate(interestRate, interestRatePeriod = 'annual') {
  const rate = Number(interestRate) / 100;
  return interestRatePeriod === 'monthly' ? rate : rate / 12;
}

/**
 * Calculates the fixed periodic installment for a loan.
 * @param {number} principal - Principal amount
 * @param {number} interestRate - Interest rate (percentage)
 * @param {number} termMonths - Loan term in months
 * @param {string} [interestType='reducing'] - 'reducing' or 'flat'
 * @param {string} [interestRatePeriod='annual'] - Whether interestRate is a 'monthly' or 'annual' rate
 * @returns {string|null} Installment amount (2dp string) or null if inputs are invalid
 */
function calculateMonthlyPayment(principal, interestRate, termMonths, interestType = 'reducing', interestRatePeriod = 'annual') {
  const P = Number(principal);
  const n = Number(termMonths);
  const r = toMonthlyRate(interestRate, interestRatePeriod);

  if (!P || !n) return null;

  if (!interestRate || !r) {
    return (P / n).toFixed(2);
  }

  if (interestType === 'flat') {
    // Total interest over the full term, derived from the monthly-equivalent rate
    // so the result is consistent regardless of how the source rate was quoted.
    const totalInterest = P * r * n;
    return ((P + totalInterest) / n).toFixed(2);
  }

  return (P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)).toFixed(2);
}

/**
 * Generates a complete amortization schedule for a loan
 * @param {Object} options - Loan parameters
 * @param {number} options.principal - Principal loan amount
 * @param {number} options.interestRate - Interest rate (percentage)
 * @param {number} options.termMonths - Loan term in months
 * @param {string} options.interestType - 'reducing' or 'flat'
 * @param {string} [options.interestRatePeriod='annual'] - Whether interestRate is a 'monthly' or 'annual' rate
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
    interestRatePeriod = 'annual',
    startDate,
    paymentFrequency = 'monthly'
  } = options;

  const P = parseFloat(principal);
  const monthlyRate = toMonthlyRate(interestRate, interestRatePeriod);
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
    // Flat interest: Total interest calculated upfront and divided equally.
    // Derived from the monthly-equivalent rate so results are consistent
    // regardless of how the source rate is quoted (monthly vs annual).
    const totalInterest = P * monthlyRate * n;
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
        feesAmount: 0,
        totalAmount: parseFloat(installmentAmount.toFixed(2)),
        remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2))
      });
    }
  } else {
    // Reducing balance: Interest calculated on remaining balance
    const monthlyPayment = parseFloat(calculateMonthlyPayment(P, interestRate, n, 'reducing', interestRatePeriod));

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
        feesAmount: 0,
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
 * @param {number} interestRate - Interest rate (percentage)
 * @param {number} termMonths - Term in months
 * @param {string} interestType - 'reducing' or 'flat'
 * @param {string} [interestRatePeriod='annual'] - Whether interestRate is a 'monthly' or 'annual' rate
 * @returns {number} Total interest amount
 */
function calculateTotalInterest(principal, interestRate, termMonths, interestType = 'reducing', interestRatePeriod = 'annual') {
  const schedule = generateAmortizationSchedule({
    principal,
    interestRate,
    termMonths,
    interestType,
    interestRatePeriod,
    startDate: new Date()
  });

  return schedule.reduce((sum, installment) => sum + installment.interestAmount, 0);
}

module.exports = {
  calculateMonthlyPayment,
  generateAmortizationSchedule,
  calculateTotalInterest
};
