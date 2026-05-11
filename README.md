# Aris Loan Management System (LMS)

A comprehensive web-based Loan Management System designed to manage loan products, client information, loan applications, payments, members, and financial accounting for microfinance institutions.

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Key Features](#key-features)
- [Database](#database)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## 🎯 System Overview

Aris LMS is a full-stack application built to manage the complete lifecycle of loan products and client interactions in microfinance settings. The system includes:

- **Client Management**: Track client information and KYC status
- **Loan Products**: Define and manage different loan product types
- **Loan Applications & Tracking**: Create, process, and monitor loan applications
- **Payment Processing**: Handle loan repayments and payment schedules
- **Credit Scoring**: Evaluate creditworthiness and risk assessment
- **Member Contributions**: Track member savings and contributions
- **Financial Accounting**: Chart of accounts, ledger entries, journal management
- **Audit Logging**: Comprehensive audit trail for all system activities
- **Notifications**: Email and SMS notifications for important events
- **Role-Based Access Control**: Secure role-based permission system

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.1.0
- **Database ORM**: Sequelize 6.37.7
- **Database**: PostgreSQL (pg 8.16.3)
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Password Hashing**: bcryptjs & bcrypt
- **HTTP Logging**: Morgan 1.10.1
- **Logging**: Winston 3.18.3
- **API Documentation**: Swagger/OpenAPI (swagger-jsdoc, swagger-ui-express)
- **Email**: Nodemailer 7.0.6
- **SMS**: Twilio 5.10.0
- **Task Scheduling**: node-cron 4.2.1
- **Input Validation**: Joi 18.0.2
- **CORS**: cors 2.8.5
- **Environment**: dotenv 17.2.2
- **Development**: nodemon 3.1.14

### Frontend
- **Framework**: React 19.1.1 with React DOM
- **Build Tool**: Vite 7.1.6
- **Routing**: React Router DOM 7.9.1
- **HTTP Client**: Axios 1.12.2
- **Linting**: ESLint 9.35.0
- **Development Server**: Vite Dev Server

## 📁 Project Structure

```
arislms/
├── backend/                          # Node.js/Express API server
│   ├── config/                       # Configuration files
│   │   ├── db.js                     # Database configuration
│   │   ├── logger.js                 # Winston logger setup
│   │   └── sequalize_db.js           # Sequelize ORM configuration
│   ├── controllers/                  # Request handlers
│   │   ├── auditController.js
│   │   ├── authController.js
│   │   ├── chartOfAccountController.js
│   │   ├── clientController.js
│   │   ├── creditScoreController.js
│   │   ├── ledgerController.js
│   │   ├── loanController.js
│   │   ├── loanProductController.js
│   │   ├── memberContributionController.js
│   │   ├── notificationController.js
│   │   ├── paymentController.js
│   │   ├── roleController.js
│   │   └── userController.js
│   ├── dtos/                         # Data Transfer Objects
│   │   ├── chartOfAccount/
│   │   ├── client/
│   │   ├── creditScore/
│   │   ├── journalEntry/
│   │   ├── loan/
│   │   ├── loanProduct/
│   │   ├── loanScoring/
│   │   ├── memberContribution/
│   │   ├── payment/
│   │   ├── repaymentSchedule/
│   │   ├── role/
│   │   └── user/
│   ├── enums/                        # Enumeration constants
│   │   ├── accountType.js
│   │   ├── clientStatus.js
│   │   ├── contributionType.js
│   │   ├── interestType.js
│   │   ├── journalEntryStatus.js
│   │   ├── kycStatus.js
│   │   ├── loanStatus.js
│   │   └── loanTransactionType.js
│   ├── middleware/                   # Express middleware
│   │   └── authMiddleware.js         # JWT authentication
│   ├── models/                       # Sequelize database models
│   │   ├── auditLogModel.js
│   │   ├── chartOfAccountModel.js
│   │   ├── clientModel.js
│   │   ├── creditScoreModel.js
│   │   ├── journalEntryModel.js
│   │   ├── journalEntryLineModel.js
│   │   ├── loanModel.js
│   │   ├── loanProductModel.js
│   │   ├── loanTransactionModel.js
│   │   ├── memberContributionModel.js
│   │   ├── notificationModel.js
│   │   ├── paymentModel.js
│   │   ├── repaymentScheduleModel.js
│   │   ├── roleModel.js
│   │   ├── userModel.js
│   │   └── index.js                  # Model associations
│   ├── routes/                       # API route definitions
│   ├── services/                     # Business logic layer
│   │   ├── auditService.js
│   │   ├── authService.js
│   │   ├── chartOfAccountService.js
│   │   ├── clientService.js
│   │   ├── creditScoreService.js
│   │   ├── ledgerService.js
│   │   ├── loanProductService.js
│   │   ├── loanService.js
│   │   ├── loanTransactionService.js
│   │   ├── memberContributionService.js
│   │   ├── notificationService.js
│   │   ├── paymentService.js
│   │   ├── roleService.js
│   │   ├── userService.js
│   │   └── riskPolicyService.js
│   ├── utils/                        # Utility functions
│   │   ├── auditLogger.js            # Audit logging helper
│   │   ├── helpers.js                # Common helpers
│   │   ├── loanCalculator.js         # Loan calculation utilities
│   │   └── loanTransactionEmitter.js # Event emission for transactions
│   ├── scripts/                      # Database scripts
│   │   ├── initAuditTable.js
│   │   ├── migrateAuditActorId.js
│   │   └── seedChartOfAccounts.js
│   ├── logs/                         # Log files directory
│   ├── server.js                     # Express server entry point
│   ├── swagger.js                    # Swagger/OpenAPI configuration
│   ├── package.json
│   └── .env.example                  # Example environment variables
└── frontend/                         # React frontend application
    └── loan-app/
        ├── src/                      # React components and pages
        ├── public/                   # Static assets
        ├── index.html                # HTML entry point
        ├── vite.config.js            # Vite configuration
        ├── package.json
        └── eslint.config.js          # ESLint configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v16 or higher
- **PostgreSQL**: v12 or higher
- **npm** or **yarn**: Package manager
- **Git**: Version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/arislms.git
   cd arislms
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend/loan-app
   npm install
   ```

## ⚙️ Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arislms_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_DIALECT=postgres

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION=24h

# Email Configuration (Nodemailer)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@arislms.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/loan-app` directory:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## ▶️ Running the Application

### Backend Server

```bash
cd backend

# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The backend server will start on `http://localhost:5000`

### Frontend Application

```bash
cd frontend/loan-app

# Development mode
npm run dev

# Build for production
npm build

# Preview production build
npm run preview
```

The frontend will be available at `http://localhost:5173` (default Vite port)

## 📚 API Documentation

The API documentation is automatically generated using Swagger/OpenAPI and is available at:

```
http://localhost:5000/api-docs
```

This interactive documentation allows you to:
- View all available API endpoints
- Understand request/response schemas
- Test API endpoints directly from the browser

### Main API Endpoints

| Resource | Base URL | Description |
|----------|----------|-------------|
| Users | `/api/users` | User management |
| Authentication | `/api/auth` | Login, logout, token refresh |
| Roles | `/api/roles` | Role and permission management |
| Clients | `/api/clients` | Client information and KYC |
| Loans | `/api/loans` | Loan application and management |
| Loan Products | `/api/loan-products` | Loan product definitions |
| Payments | `/api/payments` | Payment processing and tracking |
| Member Contributions | `/api/member-contributions` | Member savings tracking |
| Credit Scores | `/api/credit-scores` | Credit scoring and evaluation |
| Notifications | `/api/notifications` | Email and SMS notifications |
| Chart of Accounts | `/api/chart-of-accounts` | Accounting chart setup |
| Ledger | `/api/ledger` | General ledger entries |
| Audit Logs | `/api/audits` | System audit trail |

## 🎨 Key Features

### 1. **Client Management**
- Client registration and profiling
- KYC (Know Your Customer) status tracking
- Client status management (Active, Inactive, Suspended)
- Contact information and documentation

### 2. **Loan Management**
- Multiple loan product definitions
- Customizable loan terms and conditions
- Loan application workflow
- Loan status tracking (Pending, Approved, Disbursed, Active, Completed)
- Interest calculation and management

### 3. **Payment Processing**
- Flexible payment scheduling
- Multiple payment methods support
- Payment tracking and reconciliation
- Automatic payment calculations
- Overdue payment management

### 4. **Member Contributions**
- Member savings accounts
- Contribution types (Mandatory, Voluntary)
- Contribution tracking and history
- Automatic contribution deductions

### 5. **Credit Scoring**
- Automated credit evaluation
- Risk assessment policies
- Credit score tracking
- Historical credit data analysis

### 6. **Financial Accounting**
- Chart of accounts management
- Journal entry creation and posting
- General ledger maintenance
- Trial balance generation
- Financial reporting capabilities

### 7. **Audit & Compliance**
- Comprehensive audit logging
- User activity tracking
- Change history
- Compliance reporting
- Regulatory requirements support

### 8. **Notifications**
- Email notifications (via Nodemailer)
- SMS notifications (via Twilio)
- Scheduled reminders
- Custom notification templates

### 9. **Security**
- Role-based access control (RBAC)
- JWT-based authentication
- Password encryption with bcryptjs
- CORS protection
- Input validation with Joi

### 10. **Scheduled Tasks**
- Automated loan interest calculations
- Payment reminders
- Report generation
- Data cleanup and archival
- Configurable with node-cron

## 🗄️ Database

### Database Setup

1. **Create PostgreSQL Database**
   ```sql
   CREATE DATABASE arislms_db;
   ```

2. **Create Database User** (if needed)
   ```sql
   CREATE USER arislms_user WITH PASSWORD 'your_password';
   ALTER ROLE arislms_user SET client_encoding TO 'utf8';
   ALTER ROLE arislms_user SET default_transaction_isolation TO 'read committed';
   ALTER ROLE arislms_user SET default_transaction_deferrable TO on;
   GRANT ALL PRIVILEGES ON DATABASE arislms_db TO arislms_user;
   ```

3. **Run Migrations/Seed Scripts**
   ```bash
   cd backend
   node scripts/seedChartOfAccounts.js
   node scripts/initAuditTable.js
   ```

### Database Models

The system uses Sequelize ORM with the following main models:

- **User**: System users and staff
- **Role**: User roles and permissions
- **Client**: Loan clients/applicants
- **Loan**: Loan applications and records
- **LoanProduct**: Loan product definitions
- **Payment**: Payment transactions
- **LoanTransaction**: Loan-related transactions
- **RepaymentSchedule**: Scheduled loan repayments
- **MemberContribution**: Member savings
- **CreditScore**: Client credit evaluations
- **ChartOfAccount**: Accounting accounts
- **JournalEntry**: Journal transactions
- **AuditLog**: System audit trail
- **Notification**: Notification records

## 👨‍💻 Development

### Project Structure Best Practices

The project follows a layered architecture:

- **Controllers**: Handle HTTP requests/responses
- **Services**: Contain business logic
- **Models**: Database schema definitions
- **DTOs**: Data validation and transfer objects
- **Middleware**: Request interceptors
- **Routes**: API endpoint definitions
- **Utils**: Helper functions and utilities

### Code Standards

- Use consistent naming conventions (camelCase for JS)
- Add JSDoc comments for functions
- Validate all inputs using Joi
- Log important operations using Winston
- Handle errors with try-catch and proper error responses
- Use async/await for asynchronous operations

### Running Tests

Currently, no tests are configured. To set up testing:

```bash
npm install --save-dev jest supertest
```

Then update package.json scripts section with test configuration.

### Linting (Frontend)

```bash
cd frontend/loan-app
npm run lint
```

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
3. Push to the branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

---

## 🆘 Troubleshooting

### Backend won't start
- Ensure PostgreSQL is running
- Check `.env` file configuration
- Verify database credentials
- Check logs in `backend/logs` directory

### Frontend won't compile
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf .vite`
- Restart dev server

### Database connection errors
- Verify PostgreSQL service is running
- Test connection: `psql -U postgres -h localhost`
- Check DATABASE_URL environment variable

### CORS issues
- Verify `FRONTEND_URL` in backend `.env`
- Ensure frontend is running on correct port
- Check CORS middleware configuration

## 📞 Support

For issues or questions, please:
1. Check existing documentation
2. Review API documentation at `/api-docs`
3. Check application logs in `backend/logs`
4. Contact the development team

---

**Last Updated**: May 2026
**Version**: 1.0.0
