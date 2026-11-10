using System.Globalization;
using System.Text.Json;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Orders;
public sealed class OrderRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> List(long user,CancellationToken ct)=>db.Query(@"
        SELECT order_id AS ""id"",order_number AS ""orderNumber"",status,total_minor AS ""totalMinor"",currency,
        created_at AS ""createdAt"" FROM ORDERS WHERE user_id=:user_id
        ORDER BY created_at DESC FETCH FIRST 100 ROWS ONLY",ModuleRules.P(("user_id",user)),ct);
    public Task<Dictionary<string,object?>?> Get(long user,long id,CancellationToken ct)=>db.One(@"
        SELECT order_id AS ""id"",order_number AS ""orderNumber"",status,total_minor AS ""totalMinor"",currency,
        created_at AS ""createdAt"" FROM ORDERS WHERE user_id=:user_id AND order_id=:id",
        ModuleRules.P(("user_id",user),("id",id)),ct);

    public async Task<object> Checkout(long user,long addressId,string key,CancellationToken ct) =>
      await db.Transaction<object>(async (conn,tx)=> {
        var hash=ModuleRules.Hash($"CHECKOUT:{user}:{addressId}");
        var existing=await db.One(@"SELECT request_hash,state,response_ref FROM IDEMPOTENCY_KEYS
            WHERE user_id=:user_id AND operation='CHECKOUT' AND key_value=:key FOR UPDATE",
            ModuleRules.P(("user_id",user),("key",key)),ct,conn,tx);
        if(existing is not null)
        {
            ModuleRules.Conflict(ModuleRules.Str(existing,"REQUEST_HASH")==hash,"Idempotency key reused for a different request.");
            ModuleRules.Conflict(ModuleRules.Str(existing,"STATE")=="COMPLETED","Checkout is already being processed.");
            return new { id=long.Parse(ModuleRules.Str(existing,"RESPONSE_REF"),CultureInfo.InvariantCulture),
                status="PLACED",replayed=true };
        }
        await db.Execute(@"INSERT INTO IDEMPOTENCY_KEYS(user_id,operation,key_value,request_hash,expires_at)
            VALUES (:user_id,'CHECKOUT',:key,:hash,SYSTIMESTAMP+NUMTODSINTERVAL(24,'HOUR'))",
            ModuleRules.P(("user_id",user),("key",key),("hash",hash)),ct,conn,tx);
        var address=await db.One(@"SELECT address_id,recipient_name,phone_e164,line_1,line_2,city,region,
           postal_code,country_code FROM ADDRESSES WHERE address_id=:id AND user_id=:user_id
           AND scope='SHIPPING' AND status='ACTIVE'",
           ModuleRules.P(("id",addressId),("user_id",user)),ct,conn,tx);
        ModuleRules.Found(address is not null);
        var cart=await db.One("SELECT cart_id FROM CARTS WHERE user_id=:user_id FOR UPDATE",
            ModuleRules.P(("user_id",user)),ct,conn,tx);
        ModuleRules.Conflict(cart is not null,"Your shopping cart is empty.");
        var cartId=ModuleRules.Id(cart!,"CART_ID");
        // All prices are read from trusted product rows; the client never supplies totals.
        var lines=await db.Query(@"SELECT ci.product_id,p.sku,p.title,p.price_minor,p.currency,ci.quantity
            FROM CART_ITEMS ci JOIN FOOD_PRODUCTS p ON p.product_id=ci.product_id
            WHERE ci.cart_id=:cart_id AND p.status='ACTIVE' ORDER BY ci.product_id",
            ModuleRules.P(("cart_id",cartId)),ct,conn,tx);
        var cartCount=await db.Scalar("SELECT COUNT(*) FROM CART_ITEMS WHERE cart_id=:id",
            ModuleRules.P(("id",cartId)),ct,conn,tx);
        ModuleRules.Conflict(lines.Count>0 && lines.Count==Convert.ToInt32(cartCount),
            "The cart is empty or contains unavailable products.");
        string? currency=null;long subtotal=0;
        foreach(var line in lines)
        {
            var itemCurrency=ModuleRules.Str(line,"CURRENCY");
            ModuleRules.Conflict(currency is null || currency==itemCurrency,"Multiple currencies cannot share one order.");
            currency=itemCurrency;
            var qty=ModuleRules.Id(line,"QUANTITY");
            ModuleRules.Conflict(qty is >0 and <=999);
            subtotal=checked(subtotal+checked(qty*ModuleRules.Id(line,"PRICE_MINOR")));
        }
        var snapshot=JsonSerializer.Serialize(new {
            recipientName=address!["RECIPIENT_NAME"],phone=address["PHONE_E164"],
            line1=address["LINE_1"],line2=address["LINE_2"],city=address["CITY"],
            region=address["REGION"],postalCode=address["POSTAL_CODE"],countryCode=address["COUNTRY_CODE"] });
        ModuleRules.Check(snapshot.Length<4000,"shippingAddress");
        var number="PC-"+Guid.NewGuid().ToString("N").ToUpperInvariant();
        var orderId=await db.InsertId(@"INSERT INTO ORDERS(order_number,user_id,shipping_address_id,shipping_address_snapshot,
           subtotal_minor,shipping_minor,tax_minor,discount_minor,total_minor,currency)
           VALUES (:number,:user_id,:address,:snapshot,:subtotal,0,0,0,:total,:currency)",
           ModuleRules.P(("number",number),("user_id",user),("address",addressId),("snapshot",snapshot),
             ("subtotal",subtotal),("total",subtotal),("currency",currency)),"order_id",ct,conn,tx);
        // Conditional reservations prevent overselling, even between concurrent shoppers.
        foreach(var line in lines)
        {
            var productId=ModuleRules.Id(line,"PRODUCT_ID");var qty=ModuleRules.Id(line,"QUANTITY");
            var updated=await db.Execute(@"UPDATE INVENTORY_STOCK SET reserved_qty=reserved_qty+:qty,
              updated_at=SYSTIMESTAMP WHERE product_id=:id AND on_hand_qty-reserved_qty>=:qty",
              ModuleRules.P(("qty",qty),("id",productId)),ct,conn,tx);
            ModuleRules.Conflict(updated==1,"A product has insufficient available stock.");
            await db.Execute(@"INSERT INTO ORDER_ITEMS(order_id,product_id,sku_snapshot,title_snapshot,
               quantity,unit_price_minor,line_total_minor,currency) VALUES
               (:order_id,:product,:sku,:title,:qty,:price,:total,:currency)",
               ModuleRules.P(("order_id",orderId),("product",productId),("sku",line["SKU"]),
                 ("title",line["TITLE"]),("qty",qty),("price",line["PRICE_MINOR"]),
                 ("total",checked(qty*ModuleRules.Id(line,"PRICE_MINOR"))),("currency",currency)),ct,conn,tx);
            await db.Execute(@"INSERT INTO ORDER_STOCK_RESERVATIONS(order_id,product_id,quantity,expires_at)
                VALUES (:order_id,:product,:qty,SYSTIMESTAMP+NUMTODSINTERVAL(30,'MINUTE'))",
                ModuleRules.P(("order_id",orderId),("product",productId),("qty",qty)),ct,conn,tx);
        }
        await db.Execute("DELETE FROM CART_ITEMS WHERE cart_id=:id",ModuleRules.P(("id",cartId)),ct,conn,tx);
        await db.Execute("UPDATE CARTS SET cart_version=cart_version+1,updated_at=SYSTIMESTAMP WHERE cart_id=:id",
            ModuleRules.P(("id",cartId)),ct,conn,tx);
        await db.Execute(@"UPDATE IDEMPOTENCY_KEYS SET state='COMPLETED',response_ref=:ref
            WHERE user_id=:user_id AND operation='CHECKOUT' AND key_value=:key",
            ModuleRules.P(("ref",orderId.ToString(CultureInfo.InvariantCulture)),("user_id",user),("key",key)),ct,conn,tx);
        return new { id=orderId,orderNumber=number,status="PLACED",totalMinor=subtotal,currency,
            paymentStatus="NOT_PAID",replayed=false };
      },ct);

    public async Task<int> Cancel(long user,long id,CancellationToken ct)=>await db.Transaction(async (c,t)=>{
        var order=await db.One("SELECT status FROM ORDERS WHERE order_id=:id AND user_id=:user_id FOR UPDATE",
            ModuleRules.P(("id",id),("user_id",user)),ct,c,t);
        ModuleRules.Found(order is not null);
        ModuleRules.Conflict(ModuleRules.Str(order!,"STATUS")=="PLACED","Only unpaid placed orders may be cancelled.");
        var pay=await db.Scalar(@"SELECT COUNT(*) FROM PAYMENTS WHERE order_id=:id
            AND state IN ('PENDING','AUTHORIZED','CAPTURED')",ModuleRules.P(("id",id)),ct,c,t);
        ModuleRules.Conflict(Convert.ToInt64(pay)==0,"Payment processing is in progress.");
        var reservations=await db.Query(@"SELECT product_id,quantity FROM ORDER_STOCK_RESERVATIONS
            WHERE order_id=:id AND state='RESERVED' ORDER BY product_id FOR UPDATE",
            ModuleRules.P(("id",id)),ct,c,t);
        foreach(var reservation in reservations)
        {
            await db.Execute(@"UPDATE INVENTORY_STOCK SET reserved_qty=reserved_qty-:qty,
                updated_at=SYSTIMESTAMP WHERE product_id=:product AND reserved_qty>=:qty",
                ModuleRules.P(("qty",ModuleRules.Id(reservation,"QUANTITY")),
                   ("product",ModuleRules.Id(reservation,"PRODUCT_ID"))),ct,c,t);
        }
        await db.Execute(@"UPDATE ORDER_STOCK_RESERVATIONS SET state='RELEASED',closed_at=SYSTIMESTAMP
            WHERE order_id=:id AND state='RESERVED'",ModuleRules.P(("id",id)),ct,c,t);
        return await db.Execute("UPDATE ORDERS SET status='CANCELLED',updated_at=SYSTIMESTAMP WHERE order_id=:id",
            ModuleRules.P(("id",id)),ct,c,t);
    },ct);
}
