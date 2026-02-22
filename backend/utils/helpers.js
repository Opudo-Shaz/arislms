

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
  return role === 2 || role === 1; // Assuming role_id 2 is admin
}


module.exports = {
  formatDateWithOffset,
  getUserId,
  getUser,
  validateClientPayload,
  calculateEndDate,
  getUserFullName,
  isAdmin
};
