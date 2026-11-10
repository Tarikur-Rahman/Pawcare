import {get,post,put,patch,api} from './http';
import type {Pet,Product,Adoption,LostPost,SaleListing,CartLine,Order,Visit} from '../models/domain';
export const q={
 pets:()=>get<Pet[]>('/pets'),pet:(id:number)=>get<Pet>(`/pets/${id}`),createPet:(data:unknown)=>post<unknown>('/pets',data),editPet:(id:number,data:unknown)=>patch<unknown>(`/pets/${id}`,data),
 adoption:()=>get<Adoption[]>('/adoptions',false),adoptionDetails:(id:number)=>get<Adoption>(`/adoptions/${id}`,false),
 sales:()=>get<SaleListing[]>('/marketplace/pets',false),sale:(id:number)=>get<SaleListing>(`/marketplace/pets/${id}`,false),
 lost:()=>get<LostPost[]>('/lost-found',false),lostDetails:(id:number)=>get<LostPost>(`/lost-found/${id}`,false),
 products:()=>get<Product[]>('/shop/products',false),product:(id:number)=>get<Product>(`/shop/products/${id}`,false),
 vets:()=>get<{id:number;displayName:string}[]>('/vets',false),visits:()=>get<Visit[]>('/appointments'),
 cart:()=>get<CartLine[]>('/cart'),setCart:(productId:number,quantity:number)=>put<unknown>('/cart/items',{productId,quantity}),
 orders:()=>get<Order[]>('/orders'),order:(id:number)=>get<Order>(`/orders/${id}`),
 notifications:()=>get<unknown[]>('/notifications'), dashboard:()=>get<unknown>('/reports/dashboard'),
};
