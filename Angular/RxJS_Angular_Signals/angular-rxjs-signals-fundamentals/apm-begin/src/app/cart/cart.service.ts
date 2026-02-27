import { effect, Injectable, signal } from '@angular/core';
import { CartItem } from './cart';
import { Product } from '../products/product';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  cartItems = signal<CartItem[]>([]);
  eLenght = effect(() =>
    console.log('Cart arry lenght:', this.cartItems().length),
  );
  addToCart(product: Product): void {
    this.cartItems.update((items) => [...items, { product, quantity: 1 }]);
  }
}
