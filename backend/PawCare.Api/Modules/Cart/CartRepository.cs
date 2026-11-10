using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Cart;
public sealed class CartRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Items(long user,CancellationToken ct)=>db.Query(@"
        SELECT ci.product_id AS ""productId"",ci.quantity,p.title,p.price_minor AS ""priceMinor"",p.currency
        FROM CART_ITEMS ci JOIN CARTS c ON c.cart_id=ci.cart_id JOIN FOOD_PRODUCTS p ON p.product_id=ci.product_id
        WHERE c.user_id=:id ORDER BY ci.product_id",ModuleRules.P(("id",user)),ct);
    public async Task<int> SetItem(long user,long product,int quantity,CancellationToken ct)=>
        await db.Transaction(async (c,t)=>{
            // Lock owner first to serialize lazy cart creation across concurrent requests.
            var owner=await db.One("SELECT user_id FROM USERS WHERE user_id=:id AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("id",user)),ct,c,t);
            ModuleRules.Found(owner is not null);
            var productRow=await db.One("SELECT product_id FROM FOOD_PRODUCTS WHERE product_id=:id AND status='ACTIVE'",
                ModuleRules.P(("id",product)),ct,c,t);
            ModuleRules.Found(productRow is not null);
            var cart=await db.One("SELECT cart_id FROM CARTS WHERE user_id=:id FOR UPDATE",
                ModuleRules.P(("id",user)),ct,c,t);
            var cartId=cart is null
                ? await db.InsertId("INSERT INTO CARTS(user_id) VALUES (:id)",ModuleRules.P(("id",user)),"cart_id",ct,c,t)
                : ModuleRules.Id(cart,"CART_ID");
            if(quantity==0)
                await db.Execute("DELETE FROM CART_ITEMS WHERE cart_id=:cart AND product_id=:product",
                    ModuleRules.P(("cart",cartId),("product",product)),ct,c,t);
            else
                await db.Execute(@"MERGE INTO CART_ITEMS ci USING (SELECT :cart cart_id,:product product_id FROM dual) src
                    ON (ci.cart_id=src.cart_id AND ci.product_id=src.product_id)
                    WHEN MATCHED THEN UPDATE SET ci.quantity=:qty,ci.updated_at=SYSTIMESTAMP
                    WHEN NOT MATCHED THEN INSERT (cart_id,product_id,quantity) VALUES (:cart,:product,:qty)",
                    ModuleRules.P(("cart",cartId),("product",product),("qty",quantity)),ct,c,t);
            await db.Execute("UPDATE CARTS SET cart_version=cart_version+1,updated_at=SYSTIMESTAMP WHERE cart_id=:id",
                ModuleRules.P(("id",cartId)),ct,c,t);
            return quantity;
        },ct);
}
