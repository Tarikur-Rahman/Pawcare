import React from 'react';import {ResourceList} from '../shared/ResourceList';
export default function FoodStoreScreen(){return <ResourceList title="Pet food store" subtitle="Discover food for the best of your pet's days." kind="product" path="/shop/products" publicData cacheKey="shop" detail="ProductDetails" emptyText="No products have been published yet."/>}
