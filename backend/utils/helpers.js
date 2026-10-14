

const formatDateWithOffset = (date, offsetMinutes = 0) => {
  const localDate = new Date(date.getTime() + offsetMinutes * 60000);
  return localDate.toISOString();
};

// NEW: safely get the logged-in user's ID
const getUserId = (req) => {
  if (!req || !req.user || !req.user.id) return null;
  return req.user.id;
};

// NEW: return full user object or null
const getUser = (req) => {
  if (!req || !req.user) return null;
  return req.user;
};

// Validate client payload against ClientDTO schema
const validateClientPayload = (payload) => {
  const errors = [];
  
  // Check if payload is an object
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Request payload must be a valid object'] };
  }

  // Define required and optional fields with their types
  const fieldValidation = {
    accountNumber: { required: false, type: 'string' },
    firstName: { required: true, type: 'string' },
    lastName: { required: true, type: 'string' },
    email: { required: true, type: 'string' },
    phone: { required: true, type: 'string' },
    secondaryPhone: { required: false, type: 'string' },
    dateOfBirth: { required: false, type: 'string' }, // ISO date string
    gender: { required: false, type: 'string' },
    occupation: { required: false, type: 'string' },
    employer: { required: false, type: 'string' },
    monthlyIncome: { required: false, type: 'number' },
    address: { required: false, type: 'string' },
    preferredContactMethod: { required: false, type: 'string' },
    isActive: { required: false, type: 'boolean' },
    status: { required: false, type: 'string' }
  };

  // Validate each field
  Object.entries(fieldValidation).forEach(([field, validation]) => {
    const value = payload[field];

    // Check required fields
    if (validation.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field '${field}' is required`);
      return;
    }

    // Skip validation if field is not provided and not required
    if (value === undefined || value === null) {
      return;
    }

    // Check type
    if (validation.type === 'number' && typeof value !== 'number') {
      errors.push(`Field '${field}' must be a number`);
    } else if (validation.type === 'string' && typeof value !== 'string') {
      errors.push(`Field '${field}' must be a string`);
    } else if (validation.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field '${field}' must be a boolean`);
    }
  });

  // Validate email format
  if (payload.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      errors.push('Invalid email format');
    }
  }

  // Validate phone format (basic check for digits)
  if (payload.phone && !/^\d{7,}$/.test(payload.phone.replace(/[-\s()]/g, ''))) {
    errors.push('Phone number must contain at least 7 digits');
  }

  // Check for extra fields not in DTO
  const validFields = Object.keys(fieldValidation);
  const extraFields = Object.keys(payload).filter(key => !validFields.includes(key));
  
  if (extraFields.length > 0) {
    errors.push(`Unknown fields: ${extraFields.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

function calculateEndDate(startDate, termMonths) {
  const start = new Date(startDate);
  if (isNaN(start)) {
    throw new Error('Invalid start date');
  }

  const end = new Date(start);
  end.setMonth(end.getMonth() + termMonths);
  return end;
}

function getUserFullName(first_name, middle_name, last_name){
  return [first_name, middle_name,last_name]
      .filter(Boolean)
      .join(' ');
}

function isAdmin(role) {
  const numericRole = Number(role);
  if (!Number.isNaN(numericRole)) {
    return numericRole === 2 || numericRole === 1;
  }

  if (typeof role === 'string') {
    const normalized = role.trim().toLowerCase();
    return normalized === 'admin' || normalized === 'super_admin' || normalized === 'superadmin';
  }

  return false;
}

/**
 * Rounding tolerance for money comparisons. Amounts are stored to 2 decimals,
 * so the smallest meaningful value is 0.01; this half-cent epsilon lets us treat
 * floating-point residue as zero without swallowing a real 0.01. Overridable via
 * the CURRENCY_EPSILON env var.
 */
const CURRENCY_EPSILON = Number(process.env.CURRENCY_EPSILON) || 0.005;


/**
 * Digits-only phone forms that should be treated as the same Kenyan mobile
 * number, e.g. '0712 345 678', '+254712345678' and '712345678' all yield
 * ['254712345678', '0712345678', '712345678']. Non-Kenyan / unrecognised
 * numbers are returned as their digits-only form. Used to match a phone typed
 * at portal login against however staff stored it on the client record.
 * @param {string} phone
 * @returns {string[]} candidate digit strings (empty when no digits)
 */
function phoneMatchCandidates(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return [];
  let national = null;
  if (digits.startsWith('254') && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith('0') && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  if (!national) return [digits];
  return [`254${national}`, `0${national}`, national];
}

/** "Jane Wanjiru" → "Jane W." — enough for someone who knows the person to recognise them. */
function maskName(firstName, lastName) {
  const first = String(firstName || '').trim();
  const lastInitial = String(lastName || '').trim().charAt(0);
  return [first, lastInitial ? `${lastInitial.toUpperCase()}.` : ''].filter(Boolean).join(' ') || 'Client';
}

/** "0712345678" → "07** *** 678" (keeps the first 2 and last 3 digits). */
function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 2)}** *** ${digits.slice(-3)}`;
}

/** "jane.doe@mail.com" → "j***@mail.com" */
function maskEmail(email) {
  const [user, domain] = String(email || '').split('@');
  if (!user || !domain) return null;
  return `${user.charAt(0)}***@${domain}`;
}

module.exports = {
  maskName,
  maskPhone,
  maskEmail,
  phoneMatchCandidates,
  formatDateWithOffset,
  getUserId,
  getUser,
  validateClientPayload,
  calculateEndDate,
  getUserFullName,
  isAdmin,
  CURRENCY_EPSILON
};
