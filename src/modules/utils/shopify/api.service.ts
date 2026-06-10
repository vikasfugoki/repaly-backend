import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ShopifyApiService {

    // async searchProducts(
    //     shopName: string,
    //     accessToken: string,
    //     query: Record<string, any>
    // ): Promise<any> {
    //     const shopDomain = shopName.includes('.') ? shopName : `${shopName}.myshopify.com`;
    //     const url = `https://${shopDomain}/admin/api/2026-01/products.json`;

    //     const headers = {
    //         'X-Shopify-Access-Token': accessToken,
    //         'Content-Type': 'application/json',
    //     };

    //     const params = {
    //         title: query.title,
    //         limit: query.limit || 10,
    //         fields: 'id,title,variants,images,status',
    //     };

    //     try {
    //         const response = await axios.get(url, { headers, params });
    //         const products = response.data.products || [];

    //         return products.map((p: any) => ({
    //             id: String(p.id),
    //             title: p.title,
    //             price: p.variants?.[0]?.price || null,
    //             inventory: p.variants?.[0]?.inventory_quantity || null,
    //             image: p.images?.[0]?.src || null,
    //             status: p.status,
    //         }));
    //     } catch (error) {
    //         const errorMessage = (error as Error).message;
    //         console.error(
    //             `Failed to search products for shop ${shopName}:`,
    //             errorMessage,
    //         );
    //         throw new Error(
    //             `Failed to search products on Shopify: ${errorMessage}`,
    //         );
    //     }
    // }

    async searchProducts(
    shopName: string,
    accessToken: string,
    query: Record<string, any>
    ): Promise<any> {
        const shopDomain = shopName.includes('.') ? shopName : `${shopName}.myshopify.com`;
        const headers = {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
        };

    const sku: string | undefined = query.sku?.trim();
    const title: string | undefined = query.title?.trim() || query.product_name?.trim();
    const limit = query.limit || 10;

    try {
        if (sku) {
            return await this.searchProductsBySku(shopDomain, headers, sku, limit);
        }

        return await this.searchProductsByTitle(shopDomain, headers, title, limit);
    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(`Failed to search products for shop ${shopName}:`, errorMessage);
        throw new Error(`Failed to search products on Shopify: ${errorMessage}`);
    }
}

private async searchProductsBySku(
    shopDomain: string,
    headers: Record<string, string>,
    sku: string,
    limit: number
    ): Promise<any[]> {
    // Fetch variants matching the SKU
    const variantsUrl = `https://${shopDomain}/admin/api/2026-01/variants.json`;
    const variantsResponse = await axios.get(variantsUrl, {
        headers,
        params: { sku, limit },
    });

    const variants: any[] = variantsResponse.data.variants || [];
    if (!variants.length) return [];

    // Fetch the parent products for those variants
    const productIds = [...new Set(variants.map((v: any) => v.product_id))].join(',');
    const productsUrl = `https://${shopDomain}/admin/api/2026-01/products.json`;
    const productsResponse = await axios.get(productsUrl, {
        headers,
        params: { ids: productIds, fields: 'id,title,variants,images,status' },
    });

    const products: any[] = productsResponse.data.products || [];

    // Build a variant map for quick lookup
    const variantMap = new Map(variants.map((v: any) => [v.product_id, v]));

    return products.map((p: any) => {
        const matchingVariant = variantMap.get(p.id);
        return {
            id: String(p.id),
            title: p.title,
            sku: matchingVariant?.sku || null,
            price: matchingVariant?.price || null,
            inventory: matchingVariant?.inventory_quantity || null,
            image: p.images?.[0]?.src || null,
            status: p.status,
        };
    });
}

private async searchProductsByTitle(
    shopDomain: string,
    headers: Record<string, string>,
    title: string | undefined,
    limit: number
): Promise<any[]> {
    const productsUrl = `https://${shopDomain}/admin/api/2026-01/products.json`;
    const response = await axios.get(productsUrl, {
        headers,
        params: { title, limit, fields: 'id,title,variants,images,status' },
    });

    const products: any[] = response.data.products || [];

    return products.map((p: any) => ({
        id: String(p.id),
        title: p.title,
        sku: p.variants?.[0]?.sku || null,
        price: p.variants?.[0]?.price || null,
        inventory: p.variants?.[0]?.inventory_quantity || null,
        image: p.images?.[0]?.src || null,
        status: p.status,
    }));
}
}