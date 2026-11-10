using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Inventory;
public sealed class InventoryRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> List(CancellationToken ct)=>db.Query(@"
        SELECT i.product_id AS ""productId"",p.sku,p.title,i.on_hand_qty AS ""onHandQty"",i.reserved_qty AS ""reservedQty""
        FROM INVENTORY_STOCK i JOIN FOOD_PRODUCTS p ON p.product_id=i.product_id
        ORDER BY i.product_id FETCH FIRST 200 ROWS ONLY",null,ct);
    public async Task<object> Adjust(long actor,long product,long delta,string reason,CancellationToken ct)=>
        await db.Transaction<object>(async (c,t)=>{
            var exists=await db.One("SELECT product_id FROM FOOD_PRODUCTS WHERE product_id=:id FOR UPDATE",
                ModuleRules.P(("id",product)),ct,c,t);
            ModuleRules.Found(exists is not null);
            var stock=await db.One("SELECT on_hand_qty,reserved_qty FROM INVENTORY_STOCK WHERE product_id=:id FOR UPDATE",
                ModuleRules.P(("id",product)),ct,c,t);
            if(stock is null)
            {
                ModuleRules.Check(delta>0,"quantityDelta","Initial stock must be positive.");
                await db.Execute("INSERT INTO INVENTORY_STOCK(product_id,on_hand_qty,reserved_qty) VALUES (:id,:qty,0)",
                   ModuleRules.P(("id",product),("qty",delta)),ct,c,t);
            }
            else
            {
                ModuleRules.Conflict(ModuleRules.Id(stock,"ON_HAND_QTY")+delta>=ModuleRules.Id(stock,"RESERVED_QTY"),
                    "Stock cannot be reduced below reserved units.");
                await db.Execute(@"UPDATE INVENTORY_STOCK SET on_hand_qty=on_hand_qty+:delta,updated_at=SYSTIMESTAMP
                    WHERE product_id=:id",ModuleRules.P(("delta",delta),("id",product)),ct,c,t);
            }
            await db.Execute(@"INSERT INTO INVENTORY_MOVEMENTS(product_id,quantity_delta,reason,movement_key,created_by_user_id)
                VALUES (:id,:delta,:reason,:key,:actor)",ModuleRules.P(("id",product),("delta",delta),
                ("reason",reason),("key",Guid.NewGuid().ToString("N")),("actor",actor)),ct,c,t);
            return new { productId=product,quantityDelta=delta };
        },ct);
}
