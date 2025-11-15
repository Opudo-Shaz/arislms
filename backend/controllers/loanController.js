const loanService = require('../services/loanService');
const logger = require('../config/logger');

exports.getAllLoans = async (req, res) => {
  try {
    const loans = await loanService.findAllLoans();
    logger.info(`Admin ${req.user.id} fetched all loans`);
    res.status(200).json({ success: true, data: loans });
  } catch (error) {
    logger.error(`Error fetching all loans: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error fetching loans' });
  }
};

exports.getMyLoans = async (req, res) => {
  try {
    const userId = req.user.id;
    const loans = await loanService.findLoansByUser(userId);
    logger.info(`User ${userId} fetched their loans`);
    res.status(200).json({ success: true, data: loans });
  } catch (error) {
    logger.error(`Error fetching loans for user ${req.user.id}: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error fetching your loans' });
  }
};

exports.getLoanById = async (req, res) => {
  try {
    const loanId = req.params.id;
    const user = req.user;
    const loan = await loanService.findLoanById(loanId);

    if (user.role !== 'admin' && loan.user_id !== user.id) {
      logger.warn(`Unauthorized access attempt by user ${user.id} for loan ${loanId}`);
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    logger.info(`Loan ${loanId} fetched by user ${user.id}`);
    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    logger.error(`Error fetching loan ${req.params.id}: ${error.message}`);
    res.status(404).json({ success: false, message: 'Loan not found' });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = { ...req.body, createdBy: userId, user_id: userId };

    // pass req.user to the service
    const newLoan = await loanService.createLoan(data, req.user);

    logger.info(`Loan created by user ${userId} with ID ${newLoan.id}`);
    res.status(201).json({ success: true, message: 'Loan created successfully', data: newLoan });
  } catch (error) {
    logger.error(`Error creating loan by user ${req.user.id}: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLoan = async (req, res) => {
  try {
    const loanId = req.params.id;
    const updatedLoan = await loanService.updateLoan(loanId, req.body);

    logger.info(`Loan ${loanId} updated by admin ${req.user.id}`);
    res.status(200).json({ success: true, message: 'Loan updated successfully', data: updatedLoan });
  } catch (error) {
    logger.error(`Error updating loan ${loanId}: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteLoan = async (req, res) => {
  try {
    const loanId = req.params.id;
    await loanService.deleteLoan(loanId);

    logger.warn(`Loan ${loanId} deleted by admin ${req.user.id}`);
    res.status(200).json({ success: true, message: 'Loan deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting loan ${req.params.id}: ${error.message}`);
    res.status(404).json({ success: false, message: error.message });
  }
};
