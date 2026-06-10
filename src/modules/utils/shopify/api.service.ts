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
    try {
        const query = `
            query SearchProductsBySku($searchQuery: String!, $limit: Int!) {
                productVariants(first: $limit, query: $searchQuery) {
                    edges {
                        node {
                            id
                            sku
                            price
                            inventoryQuantity
                            product {
                                id
                                title
                                status
                                featuredImage {
                                    url
                                }
                            }
                        }
                    }
                }
            }
        `;

        const response = await axios.post(
            `https://${shopDomain}/admin/api/2026-01/graphql.json`,
            {
                query,
                variables: {
                    searchQuery: `sku:${sku}`,
                    limit,
                },
            },
            { headers }
        );

        if (response.data.errors) {
            throw new Error(
                `Shopify GraphQL Error: ${JSON.stringify(response.data.errors)}`
            );
        }

        const variants =
            response.data?.data?.productVariants?.edges ?? [];

        return variants
            .map(({ node }: any) => ({
                id: String(node.product.id),
                variantId: String(node.id),
                title: node.product.title,
                sku: node.sku,
                price: node.price,
                inventory: node.inventoryQuantity,
                image: node.product.featuredImage?.url ?? null,
                status: node.product.status,
            }))
            .filter(
                (product: any) =>
                    product.sku &&
                    product.sku.toLowerCase() === sku.toLowerCase()
            );
    } catch (error: any) {
        console.error(
            `Failed to search Shopify products by SKU "${sku}":`,
            error.response?.data || error.message
        );
        return [];
    }
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