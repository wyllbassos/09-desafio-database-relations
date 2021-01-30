import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found!');
    }

    const findedProducts = await this.productsRepository.findAllById(products);

    if (findedProducts.length !== products.length) {
      throw new AppError('Invalid product list!');
    }

    const productsChange = findedProducts.map(findedProduct => {
      const { quantity } = products.filter(
        product => product.id === findedProduct.id,
      )[0];
      if (quantity > findedProduct.quantity) {
        throw new AppError('Product Insufficient Balance');
      }
      return {
        productRegister: {
          product_id: findedProduct.id,
          price: findedProduct.price,
          quantity,
          productBalance: findedProduct.quantity,
        },
        productUpdate: {
          ...findedProduct,
          quantity: findedProduct.quantity - quantity,
        },
      };
    });

    await this.productsRepository.updateQuantity(
      productsChange.map(productChange => productChange.productUpdate),
    );

    const order = await this.ordersRepository.create({
      customer,
      products: productsChange.map(
        productChange => productChange.productRegister,
      ),
    });

    return order;
  }
}

export default CreateOrderService;
