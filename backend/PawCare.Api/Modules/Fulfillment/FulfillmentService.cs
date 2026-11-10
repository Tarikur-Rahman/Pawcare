using System.Security.Claims;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Fulfillment;
public sealed record ShipmentCreate(string Carrier,string? TrackingRef);
public sealed class FulfillmentService(ModuleDb db,IOwnershipGuards guards)
{
    public async Task<object> Ship(ClaimsPrincipal user,long orderId,ShipmentCreate r,CancellationToken ct)
    {
        await guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.StoreOperator,ct);
        ModuleRules.Check(orderId>0,"orderId");
        var actor=ModuleRules.UserId(user);
        var carrier=ModuleRules.Text(r.Carrier,100,"carrier");
        var tracking=string.IsNullOrWhiteSpace(r.TrackingRef)?null:ModuleRules.Text(r.TrackingRef,160,"trackingRef");
        return await db.Transaction<object>(async (c,t)=>{
            var order=await db.One("SELECT status FROM ORDERS WHERE order_id=:id FOR UPDATE",
                ModuleRules.P(("id",orderId)),ct,c,t);
            ModuleRules.Found(order is not null);
            ModuleRules.Conflict(ModuleRules.Str(order!,"STATUS")=="PAID","Only verified paid food orders may ship.");
            var reserved=await db.Query(@"SELECT product_id,quantity FROM ORDER_STOCK_RESERVATIONS
                WHERE order_id=:id AND state='RESERVED' ORDER BY product_id FOR UPDATE",
                ModuleRules.P(("id",orderId)),ct,c,t);
            ModuleRules.Conflict(reserved.Count>0,"No active inventory reservations for the order.");
            foreach(var line in reserved)
            {
                var product=ModuleRules.Id(line,"PRODUCT_ID");var qty=ModuleRules.Id(line,"QUANTITY");
                var changed=await db.Execute(@"UPDATE INVENTORY_STOCK SET on_hand_qty=on_hand_qty-:qty,
                    reserved_qty=reserved_qty-:qty,updated_at=SYSTIMESTAMP
                    WHERE product_id=:id AND reserved_qty>=:qty AND on_hand_qty>=:qty",
                    ModuleRules.P(("qty",qty),("id",product)),ct,c,t);
                ModuleRules.Conflict(changed==1,"Stock reservation is inconsistent.");
                await db.Execute(@"INSERT INTO INVENTORY_MOVEMENTS(product_id,quantity_delta,reason,reference_type,
                    reference_id,movement_key,created_by_user_id)
                    VALUES (:product,:delta,'FULFILLMENT','ORDER',:order_num,:key,:actor)",
                    ModuleRules.P(("product",product),("delta",-qty),("order_num",orderId.ToString()),
                        ("key",$"SHIP-{orderId}-{product}"),("actor",actor)),ct,c,t);
            }
            await db.Execute(@"UPDATE ORDER_STOCK_RESERVATIONS SET state='CONSUMED',closed_at=SYSTIMESTAMP
                WHERE order_id=:id AND state='RESERVED'",ModuleRules.P(("id",orderId)),ct,c,t);
            var shipment=await db.InsertId(@"INSERT INTO SHIPMENTS(order_id,carrier,tracking_ref,status,shipped_at)
                VALUES (:id,:carrier,:tracking,'SHIPPED',SYSTIMESTAMP)",
                ModuleRules.P(("id",orderId),("carrier",carrier),("tracking",tracking)),"shipment_id",ct,c,t);
            await db.Execute("UPDATE ORDERS SET status='SHIPPED',updated_at=SYSTIMESTAMP WHERE order_id=:id",
                ModuleRules.P(("id",orderId)),ct,c,t);
            return new { id=shipment,orderId,status="SHIPPED" };
        },ct);
    }
    public async Task<object> ListOwn(ClaimsPrincipal user,long order,CancellationToken ct)
    {
        var result=await db.Query(@"SELECT s.shipment_id AS ""id"",s.carrier,s.tracking_ref AS ""trackingRef"",
           s.status,s.shipped_at AS ""shippedAt"",s.delivered_at AS ""deliveredAt""
           FROM SHIPMENTS s JOIN ORDERS o ON o.order_id=s.order_id
           WHERE o.order_id=:id AND o.user_id=:user_id ORDER BY s.shipment_id DESC",
           ModuleRules.P(("id",order),("user_id",ModuleRules.UserId(user))),ct);
        return result;
    }
}
