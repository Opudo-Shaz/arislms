const loanService = require('../services/loanService');
const logger = require('../config/logger');
const { getUserId, isAdmin } = require('../utils/helpers');
const { validateSync } = require('../utils/validationMiddleware');
const LoanResponseDto = require('../dtos/loan/LoanResponseDto');
const LoanRequestDto = require('../dtos/loan/LoanRequestDto');

exports.getAllLoans = async (req, res) => {
  try {
    const userId = getUserId(req);

    logger.info(`User ${userId} fetching all loans`);

    const loans = await loanService.getAllLoans(req.user.role, userId);
    const result = loans.map(l => new LoanResponseDto(l));

    return res.status(200).json({
      success: true,
      data: result
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
    const result = loans.map(l => new LoanResponseDto(l));

    return res.status(200).json({
      success: true,
      data: result
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

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    if (loan === 403) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own loans'
      });
    }

    return res.status(200).json({
      success: true,
      data: new LoanResponseDto(loan)
    });
  } catch (error) {
    logger.error(`GetLoanById Error (${req.params.id}): ${error.message}`);

    // Map known service errors to appropriate HTTP status codes
    const msg = (error && error.message) ? error.message : 'Server error fetching loan';
    let status = 500;
    if (/not found/i.test(msg)) status = 404;
    else if (/access denied/i.test(msg)) status = 403;

    return res.status(status).json({
      success: false,
      message: msg
    });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];


    logger.info(`User ${userId} creating a new loan`);

    // Validate request payload with Joi schema
    const validation = validateSync(req.body, LoanRequestDto.createSchema);
    if (!validation.valid) {
      logger.warn(`Loan creation validation failed: ${JSON.stringify(validation.errors)}`);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const newLoan = await loanService.createLoan(validation.value, req.user, userAgent);

    return res.status(201).json({
      success: true,
      message: 'Loan created successfully',
      data: new LoanResponseDto(newLoan)
    });
  } catch (error) {
    logger.error(`CreateLoan Error: ${error.message}`);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateLoan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];
    const loanId = req.params.id;

    logger.info(`User ${userId} updating loan ${loanId}`);

    // Validate request payload with Joi schema
    const validation = validateSync(req.body, LoanRequestDto.updateSchema);
    if (!validation.valid) {
      logger.warn(`Loan update validation failed: ${JSON.stringify(validation.errors)}`);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const updatedLoan = await loanService.updateLoan(loanId, validation.value, userId, userAgent);

    return res.status(200).json({
      success: true,
      message: 'Loan updated successfully',
      data: new LoanResponseDto(updatedLoan)
    });
  } catch (error) {
    logger.error(`UpdateLoan Error (${req.params.id}): ${error.message}`);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.approveLoan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];
    const loanId = req.params.id;
    const { approvalDate } = req.body;
    logger.info(JSON.stringify(req.user));

    if(!isAdmin(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'User not authorized to approve loans'
      });
    }

    logger.info(`User ${userId} approving loan ${loanId}`);

    // Validate approval date is provided
    if (!approvalDate) {
      return res.status(400).json({
        success: false,
        message: 'Approval date is required'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(approvalDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Expected YYYY-MM-DD'
      });
    }

    // Validate it's a valid date
    const parsedDate = new Date(approvalDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval date'
      });
    }

    const approvedLoan = await loanService.approveLoan(
      loanId,
      approvalDate,
      userId,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Loan approved successfully',
      data: new LoanResponseDto(approvedLoan)
    });
  } catch (error) {
    logger.error(`ApproveLoan Error (${req.params.id}): ${error.message}`);

    // Map known errors to appropriate status codes
    let status = 500;
    const msg = error.message;

    if (/not found/i.test(msg)) {
      status = 404;
    } else if (/cannot be approved/i.test(msg)) {
      status = 400;
    }

    return res.status(status).json({
      success: false,
      message: msg
    });
  }
};

exports.deleteLoan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];
    const loanId = req.params.id;

    logger.warn(`User ${userId} deleting loan ${loanId}`);

    await loanService.deleteLoan(loanId, userId, userAgent);

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

exports.disburseLoan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userAgent = req.headers['user-agent'];
    const loanId = req.params.id;
    const { disbursementDate } = req.body;

    logger.info(`User ${userId} disbursing loan ${loanId}`);

    // Validate disbursement date is provided
    if (!disbursementDate) {
      return res.status(400).json({
        success: false,
        message: 'Disbursement date is required'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(disbursementDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Expected YYYY-MM-DD'
      });
    }

    // Validate it's a valid date
    const parsedDate = new Date(disbursementDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid disbursement date'
      });
    }

    const result = await loanService.disburseLoan(
      loanId,
      disbursementDate,
      userId,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Loan disbursed successfully',
      data: {
        loan: new LoanResponseDto(result.loan),
        installmentsCount: result.installmentsCount,
        disbursementDate: result.loan.disbursementDate,
        nextPaymentDate: result.loan.nextPaymentDate
      }
    });
  } catch (error) {
    logger.error(`DisburseLoan Error (${req.params.id}): ${error.message}`);

    // Map known errors to appropriate status codes
    let status = 500;
    const msg = error.message;

    if (/not found/i.test(msg)) {
      status = 404;
    } else if (/cannot be disbursed|already been disbursed|already exists/i.test(msg)) {
      status = 400;
    }

    return res.status(status).json({
      success: false,
      message: msg
    });
  }
};
