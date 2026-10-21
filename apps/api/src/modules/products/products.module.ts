import { Module } from '@nestjs/common';

import { ProductPricesController } from './product-prices.controller.js';
import { ProductPricesService } from './product-prices.service.js';
import { ProductUnitsController } from './product-units.controller.js';
import { ProductUnitsService } from './product-units.service.js';
import { StockModule } from '../stock/stock.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [StockModule],
  controllers: [ProductsController, ProductUnitsController, ProductPricesController],
  providers: [ProductsService, ProductUnitsService, ProductPricesService],
})
export class ProductsModule {}
