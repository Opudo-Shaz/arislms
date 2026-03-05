const logger = require('../config/logger');
const RepaymentSchedule = require('../models/repaymentScheduleModel');
const Loan = require('../models/loanModel');

/**
 * Utility service for handling missed payments
 * Checks if payments are overdue and updates their status accordingly
 */
const missedPaymentService = {
  /**
   * Check if a repayment schedule entry is missed
   * A payment is considered missed if the due date has passed and it's not fully paid
   * @param {Object} repayment - RepaymentSchedule record
   * @param {Date} checkDate - Date to check against (default: today)
   * @returns {boolean} true if payment is missed
   */
  isPaymentMissed(repayment, checkDate = new Date()) {
    if (!repayment) return false;
    
    const dueDate = new Date(repayment.dueDate);
    const checkDateNormalized = new Date(checkDate);
    
    // Normalize dates to midnight for accurate comparison
    dueDate.setHours(0, 0, 0, 0);
    checkDateNormalized.setHours(0, 0, 0, 0);
    
    // Payment is missed if:
    // 1. Due date has passed (dueDate < today)
    // 2. Status is not 'paid' (meaning it's pending or partial)
    const dueDateHasPassed = dueDate < checkDateNormalized;
    const isNotFullyPaid = repayment.status !== 'paid';
    
    return dueDateHasPassed && isNotFullyPaid;
  },

  /**
   * Update missed payment status for a specific repayment
   * @param {number} repaymentId - ID of the repayment schedule entry
   * @returns {Object} Updated repayment record
   */
  async updateRepaymentMissedStatus(repaymentId) {
    try {
      const repayment = await RepaymentSchedule.findByPk(repaymentId);
      if (!repayment) throw new Error('Repayment schedule not found');
      
      const isMissed = this.isPaymentMissed(repayment);
      
      // Update the status to 'overdue' if missed and not already marked
      if (isMissed && repayment.status === 'pending') {
        await repayment.update({
          status: 'overdue',
          isMissed: true
        });
        logger.info(`Repayment ${repaymentId} marked as overdue/missed`);
      } else if (isMissed && !repayment.isMissed) {
        await repayment.update({ isMissed: true });
        logger.info(`Repayment ${repaymentId} flagged as missed`);
      }
      
      return repayment;
    } catch (error) {
      logger.error(`Error updating missed payment status for repayment ${repaymentId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Calculate and update missed payments count for a loan
   * @param {number} loanId - ID of the loan
   * @returns {Object} {missedCount, updatedLoan}
   */
  async updateLoanMissedPaymentCount(loanId) {
    try {
      const loan = await Loan.findByPk(loanId, {
        include: [{ association: 'repaymentSchedules', required: false }]
      });
      
      if (!loan) throw new Error('Loan not found');
      
      // Count missed payments from repayment schedules
      let missedCount = 0;
      
      if (loan.repaymentSchedules && loan.repaymentSchedules.length > 0) {
        for (const repayment of loan.repaymentSchedules) {
          if (this.isPaymentMissed(repayment)) {
            missedCount++;
            
            // Update individual repayment status
            if (!repayment.isMissed || repayment.status === 'pending') {
              await repayment.update({
                status: 'overdue',
                isMissed: true
              });
            }
          }
        }
      }
      
      // Update loan's missed payment count
      const updatedLoan = await loan.update({
        missedPaymentsCount: missedCount
      });
      
      logger.info(`Loan ${loanId} missed payments count updated to ${missedCount}`);
      
      return {
        missedCount,
        updatedLoan
      };
    } catch (error) {
      logger.error(`Error updating missed payment count for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get all loans with missed payments
   * @returns {Array} Array of loans with missed payments
   */
  async getLoansWithMissedPayments() {
    try {
      const loans = await Loan.findAll({
        where: { missedPaymentsCount: { [require('sequelize').Op.gt]: 0 } },
        include: [
          {
            association: 'repaymentSchedules',
            required: false,
            where: { isMissed: true }
          }
        ],
        order: [['missedPaymentsCount', 'DESC']]
      });
      
      logger.info(`Retrieved ${loans.length} loans with missed payments`);
      return loans;
    } catch (error) {
      logger.error(`Error fetching loans with missed payments: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get missed repayments for a specific loan
   * @param {number} loanId - ID of the loan
   * @returns {Array} Array of missed repayment schedule entries
   */
  async getMissedRepaymentsForLoan(loanId) {
    try {
      const repayments = await RepaymentSchedule.findAll({
        where: {
          loanId,
          isMissed: true
        },
        order: [['dueDate', 'ASC']]
      });
      
      logger.info(`Retrieved ${repayments.length} missed repayments for loan ${loanId}`);
      return repayments;
    } catch (error) {
      logger.error(`Error fetching missed repayments for loan ${loanId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Batch update missed payments for all loans
   * Call this periodically (e.g., via cron job) to update all overdue payments
   * @returns {Object} Summary of updates
   */
  async updateAllMissedPayments() {
    try {
      logger.info('Starting batch update of missed payments across all loans');
      
      const loans = await Loan.findAll({
        include: [{ association: 'repaymentSchedules', required: false }]
      });
      
      let totalLoansUpdated = 0;
      let totalMissedPayments = 0;
      
      for (const loan of loans) {
        const result = await this.updateLoanMissedPaymentCount(loan.id);
        if (result.missedCount > 0) {
          totalLoansUpdated++;
          totalMissedPayments += result.missedCount;
        }
      }
      
      logger.info(
        `Batch missed payment update completed: ${totalLoansUpdated} loans updated, ${totalMissedPayments} total missed payments`
      );
      
      return {
        totalLoansUpdated,
        totalMissedPayments,
        success: true
      };
    } catch (error) {
      logger.error(`Error in batch update of missed payments: ${error.message}`);
      throw error;
    }
  }
};

module.exports = missedPaymentService;
