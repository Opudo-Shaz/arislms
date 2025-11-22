const loanService = require('../services/loanService');
const logger = require('../config/logger');

exports.getAllLoans = async (req, res) => {
  try {
    const loans = await loanService.getAllLoans(req.user.role, req.user.id);
    logger.info(`User ${req.user.id} fetched loans`);
    res.status(200).json({ success: true, data: loans });
  } catch (error) {
    logger.error(`Error fetching loans: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error fetching loans' });
  }
};

exports.getMyLoans = async (req, res) => {
  try {
    const loans = await loanService.getAllLoans('user', req.user.id);
    res.status(200).json({ success: true, data: loans });
  } catch (error) {
    logger.error(`Error fetching user loans: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error fetching your loans' });
  }
};

exports.getLoanById = async (req, res) => {
  try {
    const loan = await loanService.getLoanById(
      req.params.id,
      req.user.role,
      req.user.id
    );

    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    logger.error(`Error fetching loan ${req.params.id}: ${error.message}`);
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const payload = { ...req.body };
    const newLoan = await loanService.createLoan(payload, req.user);

    res.status(201).json({
      success: true,
      message: 'Loan created successfully',
      data: newLoan
    });
  } catch (error) {
    logger.error(`Error creating loan: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLoan = async (req, res) => {
  try {
    const updatedLoan = await loanService.updateLoan(req.params.id, req.body);
    res.status(200).json({ success: true, data: updatedLoan });
  } catch (error) {
    logger.error(`Error updating loan: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteLoan = async (req, res) => {
  try {
    await loanService.deleteLoan(req.params.id);
    res.status(200).json({ success: true, message: 'Loan deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting loan: ${error.message}`);
    res.status(404).json({ success: false, message: error.message });
  }
};
