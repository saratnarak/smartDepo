import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard } from './common/auth/jwt-auth.guard.js';
import { PermissionsGuard } from './common/auth/permissions.guard.js';
import { RateLimitGuard } from './common/auth/rate-limit.guard.js';
import { AuditLogModule } from './modules/audit-log/audit-log.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { CreditModule } from './modules/credit/credit.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { DepotsModule } from './modules/depots/depots.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InvoicesModule } from './modules/invoices/invoices.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PlansModule } from './modules/plans/plans.module.js';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { PurchasesModule } from './modules/purchases/purchases.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { StockModule } from './modules/stock/stock.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({ global: true }),
    HealthModule,
    AuthModule,
    UsersModule,
    DepotsModule,
    CategoriesModule,
    ProductsModule,
    StockModule,
    SuppliersModule,
    PurchasesModule,
    CustomersModule,
    InvoicesModule,
    PaymentsModule,
    CreditModule,
    ReportsModule,
    PlansModule,
    AuditLogModule,
    StorageModule,
    PlatformAdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
