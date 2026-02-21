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

module.exports = {
  calculateMonthlyPayment
};
