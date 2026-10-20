# Product Requirements Document: SmartDepo

**Author:** Narak Sarat | **Program:** Computer Studies, Year 4, Semester 1 (2026-2027), Norton University | **Version:** 0.2 (draft) | **Date:** 20 October 2026

## 1. Overview

SmartDepo is a multi-tenant web platform for depots, which are wholesale distributors that sell goods such as beer, energy drinks, and rice in bulk to retailers and restaurants. A depot owner registers on SmartDepo, is approved by the platform admin, and gets a private workspace to manage products and units, sales invoices, customer credit, stock, purchases, and reports.

The project is built to cover four courses at once: Advanced Web Development, Software Security Technology, Software Engineering, and Business Intelligence. Research Methods and Paper Writing (the Friday subject) is not part of it. The final submission and demo are due at the end of December 2026.

## 2. Problem Statement

Depots sell in large volumes, in bulk units such as cartons, crates, and sacks, and most customers buy on credit. Many depots still track this on paper, in spreadsheets, or from memory. This causes:

- Confusion between units, for example cartons in stock versus bottles sold
- Unpaid customer debts that are forgotten or hard to total
- Stock that expires before it is sold, especially beer and energy drinks
- No clear view of top products, top customers, or profit
- No record of who changed a price, a stock quantity, or a customer balance
- Returnable bottles and crates that are lost or not charged

Commercial ERP systems are often too expensive and too complex for a small or medium depot. SmartDepo offers a simple system that a depot can start using right after registering, without installing anything.

## 3. Goals and Success Metrics

| Goal | Metric | Target |
| --- | --- | --- |
| Easy onboarding | Time from registration to first invoice | Under 15 minutes |
| Tenant data isolation | Successful cross-depot data access in security tests | 0 |
| Accurate stock | Difference between system stock and physical count | Under 2% variance in a test count on sample data |
| Faster invoicing | Time to create an invoice with 3 product lines | Under 1 minute |
| Credit control | Owner can see each customer's balance and overdue amount | On one screen, within 3 clicks |
| Faster reporting | Time to produce a daily or monthly sales report | Under 1 minute |
| Usability | System Usability Scale (SUS) score from test users | 68 or higher (above average) |
| Security | OWASP Top 10 test findings | No unresolved high or critical issues at the final demo |

## 4. Non-Goals (Out of Scope for This Semester)

- An online store or app where retailers order by themselves
- Real payment gateway or real subscription billing (plans and billing are simulated)
- Multiple branches or warehouses inside one depot
- Native mobile apps (the web UI is responsive instead)
- Accounting, tax filing, and full bookkeeping
- Route optimization and live GPS tracking for deliveries
- Barcode scanner hardware integration (search and manual entry only)

## 5. Target Users and Roles

| Role | Description | Main needs |
| --- | --- | --- |
| Platform Admin | SmartDepo operator | Approve, reject, and suspend depots; manage plans; view platform usage |
| Depot Owner | Registers and runs the depot | Manage staff, prices, suppliers, and customers; view reports, credit, and the audit log |
| Sales Staff | Takes orders and creates invoices | Create invoices, record customer payments, view customers and stock |
| Stock Keeper | Manages inventory | Receive purchases, adjust stock, manage products and units, see alerts |
| Delivery Staff | Delivers orders (later phase) | View assigned deliveries and update delivery status |

Customers (retailers and restaurants) are records inside a depot's workspace. They do not log in during this semester.

In a small depot one person may hold several roles. A user belongs to exactly one depot, except the Platform Admin, who belongs to the platform.

## 6. Functional Requirements

Priority: **P0** = must have, **P1** = should have, **P2** = nice to have. Every depot-level requirement applies inside one depot's workspace only.

### 6.1 Platform and Tenant Management

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Depot owner registers with depot name, owner name, phone, email, and password | P0 |
| FR-2 | Platform admin reviews new depots and approves, rejects, or suspends them | P0 |
| FR-3 | Each depot has an isolated workspace: its data is never visible to another depot | P0 |
| FR-4 | Subscription plans (for example Free Trial, Basic, Pro) with limits on users and products; billing is simulated | P1 |
| FR-5 | Platform admin dashboard: registered depots, active depots, registrations over time, plan usage | P1 |

### 6.2 Authentication and Staff

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-6 | Users log in with email or phone and a password | P0 |
| FR-7 | Owner creates, edits, and deactivates staff and assigns roles | P0 |
| FR-8 | Users can change their own password; the owner can reset staff passwords | P1 |
| FR-9 | Rate limiting or lockout after repeated failed logins | P1 |
| FR-10 | Depot settings: name, logo, address, currency, language, invoice footer | P1 |

### 6.3 Products, Categories and Units

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-11 | Create, edit, and archive products with category (for example Beer, Energy Drink, Rice), SKU, base unit, and reorder level | P0 |
| FR-12 | Several units per product with conversion (for example 1 carton = 24 bottles, 1 sack = 50 kg) | P0 |
| FR-13 | Retail and wholesale price per unit | P0 |
| FR-14 | Special prices by customer group | P1 |
| FR-15 | Batch number and expiry date for tracked products | P1 |
| FR-16 | Search and filter products by name, SKU, and category | P0 |

### 6.4 Stock Management

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-17 | Every stock change is a stock movement (purchase, sale, adjustment, return, damage) with date, user, and quantity | P0 |
| FR-18 | Current stock is derived from movements and shown in readable units (for example 12 cartons and 5 bottles) | P0 |
| FR-19 | Manual stock adjustment with a required reason | P0 |
| FR-20 | Low-stock alert at or below the reorder level | P0 |
| FR-21 | Near-expiry and expired stock alerts | P1 |
| FR-22 | Suggest the earliest-expiry batch when selling (first expiry, first out) | P2 |

### 6.5 Customers and Credit

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-23 | Manage customers (name, phone, address, type) | P0 |
| FR-24 | Credit limit and payment terms per customer | P1 |
| FR-25 | An invoice can be paid in full, paid in part, or left on credit | P0 |
| FR-26 | Record customer payments against invoices; the customer balance updates automatically | P0 |
| FR-27 | Overdue list and ageing (0-30, 31-60, and over 60 days) | P1 |
| FR-28 | Customer statement with invoices, payments, and balance | P1 |

### 6.6 Sales Orders and Invoices

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-29 | Create an invoice with several product lines, units, quantities, and prices | P0 |
| FR-30 | Completing an invoice deducts stock and updates the customer balance in one transaction | P0 |
| FR-31 | Warn or block when stock is not enough (configurable) | P1 |
| FR-32 | Discount per line or per invoice | P1 |
| FR-33 | Invoice output: on-screen view, print view, PDF download, and thermal printer (receipt-width layout) | P0 |
| FR-34 | Void or return an invoice with a reason, restricted by role, reversing stock and balance | P1 |
| FR-35 | Payment method recorded (cash, bank transfer, other) | P1 |

### 6.7 Suppliers and Purchases

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-36 | Manage suppliers (name, contact, notes) | P0 |
| FR-37 | Record a purchase with items, units, quantities, and unit cost | P0 |
| FR-38 | Receiving a purchase increases stock, saves batch and expiry, and can update the cost price | P0 |
| FR-39 | Purchase history and amount owed per supplier | P1 |

### 6.8 Delivery and Returnable Items (Later Phase)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-40 | Delivery note and delivery status (pending, out for delivery, delivered) per invoice | P2 |
| FR-41 | Track returnable bottles and crates, with deposit, per customer | P2 |

### 6.9 Reports and Dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-42 | Sales report by day, week, month, and custom date range | P0 |
| FR-43 | Sales by product, category, customer, and staff | P0 |
| FR-44 | Inventory report: current stock, low stock, near-expiry, and stock value | P0 |
| FR-45 | Credit report: outstanding balances and ageing by customer | P0 |
| FR-46 | Profit report: revenue, cost of goods sold, and gross margin by product and overall | P0 |
| FR-47 | Purchase report by supplier and period | P1 |
| FR-48 | Export reports to PDF and CSV or Excel | P1 |
| FR-49 | Depot dashboard with KPI cards and charts (see section 9) | P0 |

### 6.10 Audit Log

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-50 | Log price changes, stock adjustments, voids, payments, user and role changes, and logins, per depot | P0 |
| FR-51 | Owner can view and filter the audit log; logs cannot be edited or deleted in the app | P1 |

## 7. Non-Functional Requirements

### 7.1 Security

- **Tenant isolation:** every depot-owned table carries a depot\_id, and every query is scoped to the logged-in user's depot on the server. The scope is enforced in NestJS (guards and a tenant-aware data layer) and, as a second layer, with PostgreSQL row-level security
- Role-based access control enforced on the server for every endpoint, with a separate Platform Admin role
- Passwords hashed with bcrypt or Argon2; never stored or logged in plain text
- Token-based sessions (JWT with short expiry and refresh) that carry the user, depot, and role; the depot is never taken from the request body
- Input validation and sanitization on all API inputs (DTO validation in NestJS)
- Parameterized queries through the ORM to prevent SQL injection
- Protection against XSS, CSRF, and insecure direct object references, including guessing another depot's record IDs
- HTTPS in deployment, security headers, and CORS limited to the known frontend
- Secrets kept in environment variables, not in the repository
- Security testing against the OWASP Top 10, including automated cross-tenant access tests, with a written test report

### 7.2 Performance

- Standard pages load in under 2 seconds on a normal connection with a typical depot dataset
- Product search on the invoice screen responds in under 300 ms
- Dashboard and report queries respond in under 3 seconds for about 50,000 invoice lines in one depot
- All depot tables are indexed by depot\_id so tenant scoping does not slow queries

### 7.3 Usability

- Responsive layout that works on desktop, tablet, and phone
- Invoice screen usable with few clicks and with keyboard input
- Clear error messages and confirmation for destructive actions
- Interface in Khmer and English with a language switch; Khmer text must render correctly in the UI, invoices, receipts, and exported PDF reports (use a Khmer-supporting font)

### 7.4 Reliability and Data Integrity

- Invoice completion, stock deduction, and customer balance update happen in one database transaction
- Stock cannot go negative unless the owner enables it
- Quantities are stored in the product's base unit to avoid rounding errors; conversion is only for input and display
- Daily database backup in the deployed environment

### 7.5 Maintainability

- Modular NestJS structure, TypeScript throughout, linting and formatting rules
- Unit and integration tests for core modules (auth, tenants, sales, stock, credit, reports)
- Git with feature branches and pull requests; CI runs lint and tests

## 8. Technical Approach

| Layer | Choice |
| --- | --- |
| Frontend | Next.js with React, Zustand for client state (invoice cart, session, filters), and i18n for Khmer and English |
| Backend | NestJS (TypeScript) REST API with modules and guards |
| Database | PostgreSQL with an ORM such as Prisma or TypeORM; one shared database and schema with a depot\_id on every depot table; row-level security; SQL views for reports |
| Dashboard | Custom dashboard in Next.js using Recharts, a widely used React charting library |
| Auth | JWT with role and depot claims |
| Testing | Jest for unit and API tests, automated cross-tenant tests, and manual security testing |
| Deployment | Docker for local and demo environment; a free or low-cost cloud host for the final demo |

**Multi-tenancy approach:** one shared database and schema, with a depot\_id on every depot table. This is simpler to build and deploy than a separate database or schema per depot, and row-level security adds a second layer of protection.

**NestJS modules:** auth, platform-admin, depots (tenants), plans, users, categories, products, units, stock, customers, sales, payments, suppliers, purchases, reports, audit-log.

**Core tables:** depots, plans, subscriptions, users, roles, categories, products, product\_units, prices, batches, stock\_movements, customers, sales\_orders, sale\_items, payments, suppliers, purchase\_orders, purchase\_items, audit\_logs.

**Design rules:** (1) Stock is never edited directly; it is always the result of recorded stock movements. (2) Quantities are stored in the product's base unit and converted for display. (3) Every depot table has a depot\_id and is always queried through the tenant scope.

## 9. Business Intelligence: KPIs and Dashboards

**Depot KPI cards:** today's sales, this month's sales, number of invoices, total outstanding credit, overdue amount, gross profit and margin, low-stock items, near-expiry items.

**Depot charts and tables:**

- Sales trend over time (daily, weekly, monthly)
- Top 10 products by revenue and by quantity
- Sales by category (for example beer, energy drinks, rice)
- Top customers by sales and by outstanding balance
- Credit ageing (0-30, 31-60, over 60 days)
- Sales by day of week and peak periods
- Low-stock, near-expiry, and slow-moving stock lists
- Profit margin by product
- Purchases versus sales over time

**Platform admin dashboard:** registered depots over time, active depots, depots by plan, and pending approvals.

Data for the dashboards comes from SQL views or aggregated queries, scoped by depot, so the BI logic (data preparation, KPI definitions, aggregations) is documented and can be explained in the Business Intelligence course.

## 10. Key User Flows

1. **Register a depot:** Owner fills in the registration form, the Platform Admin approves it, the owner logs in, adds staff, products, units, and prices, and creates the first invoice.
2. **Sell on credit:** Sales Staff opens a new invoice, selects the customer, adds products in cartons or single units, applies a discount if allowed, saves the invoice as fully paid, partly paid, or on credit, and prints or downloads it. Stock and the customer balance update in the same transaction.
3. **Collect payment:** Sales Staff or Owner opens the customer, records a payment against one or more invoices, and the balance and overdue list update.
4. **Receive stock:** Stock Keeper creates a purchase from a supplier, enters items, units, costs, batch, and expiry, confirms receipt, and stock increases with a movement record.
5. **Correct stock:** Stock Keeper enters a physical count, the system shows the difference, a reason is required, and an adjustment movement and audit log entry are created.
6. **Review performance:** Owner opens the dashboard, checks KPIs and credit ageing, filters by date range, and exports a report.

## 11. Testing and Evaluation

SmartDepo is evaluated against the success metrics in section 3 using realistic generated sample data for two or three demo depots (for example a beer and drinks depot and a rice depot). No real depot or research study is required for this semester project.

**Evaluation steps:**

1. Generate sample data: products with units, customers, suppliers, and several months of sales, payments, and purchases for each demo depot.
2. Write unit and API tests for auth, tenants, sales, stock, credit, and reports, and run them in CI.
3. Run cross-tenant tests: a user from one depot must not be able to read or change another depot's data by any endpoint or record ID.
4. Check stock accuracy by comparing system stock with a simulated physical count.
5. Measure invoice time, report time, and page response time against the targets in sections 3 and 7.
6. Run security testing against the OWASP Top 10 and write a short test report with the fixes.
7. Ask a few test users to register a depot, create an invoice, and view the dashboard, then complete a short usability survey (SUS).

**Expected deliverables by course (to confirm with each lecturer):** Advanced Web Development: the working web platform. Software Security Technology: the security test report, including tenant isolation tests. Software Engineering: SRS, UML diagrams, test cases, and Git history. Business Intelligence: data model, KPI definitions, and dashboards.

## 12. Milestones

| Phase | Deliverables | Courses |
| --- | --- | --- |
| 1. Foundation | Problem statement, SRS, use case, ER, and architecture diagrams, multi-tenant design, repo and sprint board | Software Engineering |
| 2. Platform core | Depot registration and approval, tenant isolation, authentication, roles, staff management | Advanced Web Development, Software Security |
| 3. Depot core | Products and units, stock, customers, invoices, payments, suppliers and purchases | Advanced Web Development, Software Engineering |
| 4. BI layer | Sample data, SQL views, KPIs, dashboards, reports | Business Intelligence |
| 5. Security | OWASP and cross-tenant testing, fixes, security test report | Software Security |
| 6. Polish | Khmer and English, receipts and PDF, deployment, demo video, final documentation and slides; delivery and returnable items if time allows | All |

The schedule is planned backwards from the final submission and demo at the end of December 2026. Exact dates will be set once each course's deadlines are confirmed.

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scope is large (multi-tenant platform plus depot features) | Project not finished | Build P0 items first; treat P1 and P2 as optional, and keep delivery and returnable items last |
| One depot sees another depot's data | Serious security failure and a failed demo | Design tenant isolation from day 1, use row-level security, and run automated cross-tenant tests every sprint |
| Unit conversion bugs (cartons, bottles, kg) | Wrong stock and wrong invoices | Store quantities in the base unit, write unit tests for conversions |
| Sample data not realistic enough | Weak dashboard and unconvincing demo | Generate several months of varied sales, credit, and purchase data with realistic patterns |
| Khmer text does not render in PDFs and receipts | Poor invoices | Test Khmer fonts in PDF and print output early |
| Time conflict with work and other courses | Missed milestones | Weekly plan, small sprints, protect fixed study time |
| Lecturers require separate deliverables per course | Extra work | Confirm requirements early and split deliverables clearly |
| Report queries become slow | Poor dashboard experience | Use indexes on depot\_id and date, SQL views, and date-range limits |

## 14. Decisions and Open Questions

**Decided:**

- The system is called SmartDepo, a multi-tenant platform where depot owners register and use it
- It focuses on depot (wholesale) sales, for example beer, energy drinks, and rice
- The project covers four courses: Software Security Technology, Software Engineering, Business Intelligence, and Advanced Web Development; Research Methods and Paper Writing (Friday) is not included
- No real depot is needed; the project uses realistic sample data
- Invoices support thermal printer output, PDF, and print view
- The system supports Khmer and English
- The dashboard uses Recharts
- The final submission and demo are at the end of December 2026

**Still open:**

- What is the exact submission and demo date in December?
- Which deliverables does each of the four lecturers require, and can one project be submitted to all four?
- Which thermal printer model or paper width will be used for testing?
- Should a new depot be activated immediately as a free trial, or only after Platform Admin approval? This PRD assumes approval.
- Are delivery tracking and returnable bottle and crate deposits in scope, or kept as future work?
