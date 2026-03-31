import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ShopifyApiService {

    async searchProducts(
        shopName: string,
        accessToken: string,
        query: Record<string, any>
    ): Promise<any> {
        const url = `https://${shopName}/admin/api/2026-01/products.json`;

        const headers = {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
        };

        const params = {
            title: query.title,
            limit: query.limit || 10,
            fields: 'id,title,variants,images,status',
        };

        try {
            const response = await axios.get(url, { headers, params });
            const products = response.data.products || [];

            return products.map((p: any) => ({
                id: String(p.id),
                title: p.title,
                price: p.variants?.[0]?.price || null,
                inventory: p.variants?.[0]?.inventory_quantity || null,
                image: p.images?.[0]?.src || null,
                status: p.status,
            }));
        } catch (error) {
            console.error(
                `Failed to search products for shop ${shopName}:`,
                (error as Error).message,
            );
            throw new Error('Failed to search products on Shopify.');
        }
    }
}