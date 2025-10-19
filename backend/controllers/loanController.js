const loanService = require('../services/loanService');
const logger = require('../config/logger');

const getLoans = async (req, res) => {
  try {
    const loans = await loanService.getAllLoans();
    res.json(loans);
  } catch (err) {
    logger.error(`Get loans failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

const getLoan = async (req, res) => {
  try {
    const loan = await loanService.getLoanById(req.params.id);
    res.json(loan);
  } catch (err) {
    logger.warn(`Loan not found: ${err.message}`);
    res.status(404).json({ error: err.message });
  }
};

const createLoan = async (req, res) => {
  try {
    const newLoan = await loanService.createLoan(req.body);
    logger.info(`Loan created for user ${newLoan.user_id}`);
    res.status(201).json(newLoan);
  } catch (err) {
    logger.error(`Create loan failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
};

const updateLoan = async (req, res) => {
  try {
    const updatedLoan = await loanService.updateLoan(req.params.id, req.body);
    logger.info(`Loan ${req.params.id} updated`);
    res.json(updatedLoan);
  } catch (err) {
    logger.error(`Update loan failed: ${err.message}`);
    res.status(404).json({ error: err.message });
  }
};

const deleteLoan = async (req, res) => {
  try {
    const deletedLoan = await loanService.deleteLoan(req.params.id);
    logger.info(`Loan ${req.params.id} deleted`);
    res.json({ message: 'Loan deleted', loan: deletedLoan });
  } catch (err) {
    logger.error(`Delete loan failed: ${err.message}`);
    res.status(404).json({ error: err.message });
  }
};

module.exports = {
  getLoans,
  getLoan,
  createLoan,
  updateLoan,
  deleteLoan,
};
