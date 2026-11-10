using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Catalog;
public sealed class CatalogRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Categories(CancellationToken ct)=>db.Query(@"
        SELECT category_id AS ""id"",name,slug FROM FOOD_CATEGORIES
        WHERE status='ACTIVE' ORDER BY name",null,ct);
    public Task<List<Dictionary<string,object?>>> Products(CancellationToken ct)=>db.Query(@"
        SELECT p.product_id AS ""id"",p.title,p.brand,p.category_id AS ""categoryId"",p.target_species AS ""species"",
        p.price_minor AS ""priceMinor"",p.currency,GREATEST(0,NVL(s.on_hand_qty,0)-NVL(s.reserved_qty,0)) AS ""availableQuantity""
        FROM FOOD_PRODUCTS p JOIN FOOD_CATEGORIES cat ON cat.category_id=p.category_id AND cat.status='ACTIVE'
        LEFT JOIN INVENTORY_STOCK s ON s.product_id=p.product_id WHERE p.status='ACTIVE'
        ORDER BY p.product_id DESC FETCH FIRST 100 ROWS ONLY",null,ct);
    public Task<Dictionary<string,object?>?> Product(long id,CancellationToken ct)=>db.One(@"
        SELECT p.product_id AS ""id"",p.title,p.brand,p.description,p.ingredients_text AS ""ingredients"",
           p.allergen_text AS ""allergens"",p.target_species AS ""species"",p.net_weight_grams AS ""weightGrams"",
           p.price_minor AS ""priceMinor"",p.currency,
           GREATEST(0,NVL(s.on_hand_qty,0)-NVL(s.reserved_qty,0)) AS ""availableQuantity""
        FROM FOOD_PRODUCTS p JOIN FOOD_CATEGORIES cat ON cat.category_id=p.category_id AND cat.status='ACTIVE'
        LEFT JOIN INVENTORY_STOCK s ON s.product_id=p.product_id
        WHERE p.product_id=:id AND p.status='ACTIVE'",ModuleRules.P(("id",id)),ct);
    public Task<long> Create(long category,string sku,string title,string species,long price,string currency,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var row=await db.One("SELECT category_id FROM FOOD_CATEGORIES WHERE category_id=:id AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("id",category)),ct,c,t);
            ModuleRules.Found(row is not null);
            return await db.InsertId(@"INSERT INTO FOOD_PRODUCTS(category_id,sku,title,target_species,price_minor,currency)
                VALUES (:category,:sku,:title,:species,:price,:currency)",
                ModuleRules.P(("category",category),("sku",sku),("title",title),
                    ("species",species),("price",price),("currency",currency)),"product_id",ct,c,t);
        },ct);
}
