import {
  Component,
  inject
} from '@angular/core';

import { NgIf, NgFor, CurrencyPipe, AsyncPipe } from '@angular/common';
import { Product } from '../product';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { ProductService } from '../product.service';

@Component({
  selector: 'pm-product-detail',
  templateUrl: './product-detail.component.html',
  standalone: true,
  imports: [AsyncPipe, NgIf, NgFor, CurrencyPipe],
})
export class ProductDetailComponent {
  errorMessage = '';
  sub!: Subscription;
  private productService = inject(ProductService);
  // Product to display

  product$ = this.productService.product$.pipe(
    catchError((err) => {
      this.errorMessage = err;
      return EMPTY;
    }),
  );
  // Set the page title
  // pageTitle = this.product
  //   ? `Product Detail for: ${this.product.productName}`
  //   : 'Product Detail';

  pageTitle = 'profuctDetail';

  addToCart(product: Product) {}
}
