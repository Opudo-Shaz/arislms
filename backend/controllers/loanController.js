const loanService = require('../services/loanService');
const logger = require('../config/logger');
const { getUserId } = require('../utils/helpers');

exports.getAllLoans = async (req, res) => {
  try {
    const userId = getUserId(req);

    logger.info(`User ${userId} fetching all loans`);

    const loans = await loanService.getAllLoans(req.user.role, userId);

    return res.status(200).json({
      success: true,
      data: loans
    });
  } catch (error) {
    logger.error(`GetAllLoans Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching loans'
    });
  }
};

exports.getMyLoans = async (req, res) => {
  try {
    const userId = getUserId(req);

    logger.info(`User ${userId} fetching own loans`);

    const loans = await loanService.getAllLoans('user', userId);

    return res.status(200).json({
      success: true,
      data: loans
    });
  } catch (error) {
    logger.error(`GetMyLoans Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error fetching your loans'
    });
  }
};

exports.getLoanById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const loanId = req.params.id;

    logger.info(`User ${userId} fetching loan ${loanId}`);

    const loan = await loanService.getLoanById(
      loanId,
      req.user.role,
      userId
    );

    return res.status(200).json({
      success: true,
      data: loan
    });
  } catch (error) {
    logger.error(`GetLoanById Error (${req.params.id}): ${error.message}`);

    return res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const userId = getUserId(req);

    logger.info(`User ${userId} creating a new loan`);

    const payload = { ...req.body };

    const newLoan = await loanService.createLoan(payload, req.user);

    return res.status(201).json({
      success: true,
      message: 'Loan created successfully',
      data: newLoan
    });
  } catch (error) {
    logger.error(`CreateLoan Error: ${error.message}`);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateLoan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const loanId = req.params.id;

    logger.info(`User ${userId} updating loan ${loanId}`);

    const updatedLoan = await loanService.updateLoan(loanId, req.body);

    return res.status(200).json({
      success: true,
      message: 'Loan updated successfully',
      data: updatedLoan
    });
  } catch (error) {
    logger.error(`UpdateLoan Error (${req.params.id}): ${error.message}`);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteLoan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const loanId = req.params.id;

    logger.warn(`User ${userId} deleting loan ${loanId}`);

    await loanService.deleteLoan(loanId);

    return res.status(200).json({
      success: true,
      message: 'Loan deleted successfully'
    });
  } catch (error) {
    logger.error(`DeleteLoan Error (${req.params.id}): ${error.message}`);

    return res.status(404).json({
      success: false,
      message: error.message
    });
  }
};
