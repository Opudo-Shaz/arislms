const Collateral = require('../models/collateralModel');
const CollateralStatus = require('../enums/collateralStatus');
const CollateralType = require('../enums/collateralType');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

const TYPE_ALIASES = new Map([
  ['logbook', CollateralType.CAR_LOG_BOOK],
  ['car log book', CollateralType.CAR_LOG_BOOK],
  ['car_log_book', CollateralType.CAR_LOG_BOOK],
  ['title deed', CollateralType.TITLE_DEED],
  ['titledeed', CollateralType.TITLE_DEED],
  ['title_deed', CollateralType.TITLE_DEED],
  ['other', CollateralType.OTHER]
]);

function normalizeCollateralType(type) {
  if (!type) return null;
  const raw = String(type).trim().toLowerCase();
  return TYPE_ALIASES.get(raw) || raw.replace(/\s+/g, '_');
}

function normalizeCollateralItems(collateral) {
  if (!collateral) return [];
  const items = Array.isArray(collateral) ? collateral : [collateral];

  return items
    .filter(Boolean)
    .map((item) => ({
      collateralType: normalizeCollateralType(item.type),
      description: item.description || item.details || '',
      referenceNumber: item.referenceNumber || item.referenceNo || null,
      registrationNumber: item.registrationNumber || item.documentNumber || null,
      estimatedValue: item.estimatedValue ?? null,
      metadata: item.metadata || null,
      notes: item.notes || null
    }));
}

function validateCollateralInputAgainstProduct(product, collateral) {
  const normalizedItems = normalizeCollateralItems(collateral);
  const requiresCollateral = Boolean(product?.requiresCollateral);

  if (requiresCollateral && normalizedItems.length === 0) {
    throw new Error('Collateral is required for the selected loan product');
  }

  if (normalizedItems.length === 0) {
    return normalizedItems;
  }

  const allowedTypes = Array.isArray(product?.allowedCollateralTypes)
    ? product.allowedCollateralTypes.map(normalizeCollateralType).filter(Boolean)
    : [];

  for (const item of normalizedItems) {
    if (!item.collateralType) {
      throw new Error('Collateral type is required');
    }
    if (!item.description) {
      throw new Error('Collateral description is required');
    }
    if (item.estimatedValue === null || item.estimatedValue === undefined) {
      throw new Error('Collateral estimated value is required');
    }
    if (allowedTypes.length > 0 && !allowedTypes.includes(item.collateralType)) {
      throw new Error(`Collateral type ${item.collateralType} is not allowed for the selected loan product`);
    }
  }

  return normalizedItems;
}

async function createLoanCollaterals({ loan, product, collateral, actorId = null, transaction }) {
  try {
    const items = validateCollateralInputAgainstProduct(product, collateral);
    if (items.length === 0) {
      return [];
    }

    const created = await Collateral.bulkCreate(
      items.map((item) => ({
        loanId: loan.id,
        clientId: loan.clientId,
        loanProductId: loan.loanProductId,
        collateralType: item.collateralType,
        description: item.description,
        referenceNumber: item.referenceNumber,
        registrationNumber: item.registrationNumber,
        estimatedValue: item.estimatedValue,
        metadata: item.metadata,
        notes: item.notes,
        status: CollateralStatus.PLEDGED,
        createdBy: actorId,
        updatedBy: actorId
      })),
      { transaction }
    );

    logger.info(`Created ${created.length} collateral record(s) for loan ${loan.id}`);
    return created;
  } catch (error) {
    logger.error(`collateralService.createLoanCollaterals Error (loan ${loan?.id}): ${error.message}`);
    throw error;
  }
}

async function getLoanCollaterals(loanId) {
  try {
    return await Collateral.findAll({
      where: { loanId },
      order: [['created_at', 'ASC']]
    });
  } catch (error) {
    logger.error(`collateralService.getLoanCollaterals Error (loanId ${loanId}): ${error.message}`);
    throw error;
  }
}

async function setLoanCollateralStatus(loanId, status, actorId = null, options = {}) {
  try {
    const updates = { status, updatedBy: actorId };

    if (options.notes !== undefined) updates.notes = options.notes;

    if (status === CollateralStatus.VERIFIED) {
      updates.verifiedBy = actorId;
      updates.verifiedAt = new Date();
    }
    if (status === CollateralStatus.RELEASED) {
      updates.releasedBy = actorId;
      updates.releasedAt = new Date();
    }
    if (status === CollateralStatus.LIQUIDATED) {
      updates.liquidatedBy = actorId;
      updates.liquidatedAt = new Date();
    }

    const [affected] = await Collateral.update(updates, {
      where: { loanId },
      transaction: options.transaction
    });

    logger.info(`Updated ${affected} collateral record(s) for loan ${loanId} to status ${status}`);
    return affected;
  } catch (error) {
    logger.error(`collateralService.setLoanCollateralStatus Error (loanId ${loanId}): ${error.message}`);
    throw error;
  }
}

async function updateCollateralStatus(id, status, actorId = null, options = {}) {
  try {
    const collateral = await Collateral.findByPk(id, { transaction: options.transaction });
    if (!collateral) return null;

    const updates = { status, updatedBy: actorId };

    if (options.notes !== undefined) updates.notes = options.notes;

    if (status === CollateralStatus.VERIFIED) {
      updates.verifiedBy = actorId;
      updates.verifiedAt = new Date();
    }
    if (status === CollateralStatus.RELEASED) {
      updates.releasedBy = actorId;
      updates.releasedAt = new Date();
    }
    if (status === CollateralStatus.LIQUIDATED) {
      updates.liquidatedBy = actorId;
      updates.liquidatedAt = new Date();
    }

    await collateral.update(updates, { transaction: options.transaction });
    return collateral;
  } catch (error) {
    logger.error(`collateralService.updateCollateralStatus Error (id ${id}): ${error.message}`);
    throw error;
  }
}

async function syncCollateralLifecycleForLoanStatus(loan, loanStatus, actorId = null, options = {}) {
  try {
    if (!loan?.id) return 0;

    if (loanStatus === 'approved') {
      return setLoanCollateralStatus(loan.id, CollateralStatus.VERIFIED, actorId, options);
    }
    if (loanStatus === 'disbursed') {
      return setLoanCollateralStatus(loan.id, CollateralStatus.ACTIVE, actorId, options);
    }
    if (loanStatus === 'defaulted') {
      return setLoanCollateralStatus(loan.id, CollateralStatus.LIQUIDATED, actorId, options);
    }
    if (['rejected', 'cancelled', 'deleted', 'closed'].includes(loanStatus)) {
      return setLoanCollateralStatus(loan.id, CollateralStatus.RELEASED, actorId, options);
    }

    return 0;
  } catch (error) {
    logger.error(`collateralService.syncCollateralLifecycleForLoanStatus Error (loan ${loan?.id}, status ${loanStatus}): ${error.message}`);
    throw error;
  }
}

async function updateCollateralParticulars(id, data, actorId = null) {
  try {
    const collateral = await Collateral.findByPk(id);
    if (!collateral) return null;

    const updates = { updatedBy: actorId };
    if (data.collateralType !== undefined) updates.collateralType = normalizeCollateralType(data.collateralType) || data.collateralType;
    if (data.description !== undefined) updates.description = data.description;
    if (data.referenceNumber !== undefined) updates.referenceNumber = data.referenceNumber || null;
    if (data.registrationNumber !== undefined) updates.registrationNumber = data.registrationNumber || null;
    if (data.estimatedValue !== undefined) updates.estimatedValue = data.estimatedValue || null;
    if (data.notes !== undefined) updates.notes = data.notes || null;

    await collateral.update(updates);

    await AuditLogger.log({
      entityType: 'COLLATERAL',
      entityId: String(id),
      action: 'UPDATE',
      data: { changes: data },
      actorId: actorId || AuditLogger.SYSTEM_USER_ID,
      options: { actorType: 'USER' }
    });

    return collateral.reload();
  } catch (error) {
    logger.error(`collateralService.updateCollateralParticulars Error (id ${id}): ${error.message}`);
    throw error;
  }
}

module.exports = {
  normalizeCollateralType,
  normalizeCollateralItems,
  validateCollateralInputAgainstProduct,
  createLoanCollaterals,
  getLoanCollaterals,
  updateCollateralStatus,
  updateCollateralParticulars,
  setLoanCollateralStatus,
  syncCollateralLifecycleForLoanStatus
};