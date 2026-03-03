import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass, AsyncPipe } from '@angular/common';
import { Product } from '../product';
import { ProductDetailComponent } from '../product-detail/product-detail.component';
import { ProductService } from '../product.service';
import { catchError, EMPTY, Subscription, tap } from 'rxjs';

@Component({
  selector: 'pm-product-list',
  templateUrl: './product-list.component.html',
  standalone: true,
  imports: [AsyncPipe, NgIf, NgFor, NgClass, ProductDetailComponent],
})
export class ProductListComponent {
  pageTitle = 'Products';

  private productService = inject(ProductService);

  // Selected product id to highlight the entry

  readonly selectedProductId$ = this.productService.productSelected$;

  products = this.productService.products;
  errorMessage = this.productService.productsError;
  onSelected(productId: number): void {
    this.productService.productSelected(productId);
  }
}
