using PawCare.Api.Modules.Shared;
using PawCare.Api.Modules.Auth;
using PawCare.Api.Modules.Users;
using PawCare.Api.Modules.Pets;
using PawCare.Api.Modules.Medical;
using PawCare.Api.Modules.Care;
using PawCare.Api.Modules.Appointments;
using PawCare.Api.Modules.Expenses;
using PawCare.Api.Modules.Adoption;
using PawCare.Api.Modules.Donations;
using PawCare.Api.Modules.Marketplace;
using PawCare.Api.Modules.LostFound;
using PawCare.Api.Modules.Catalog;
using PawCare.Api.Modules.Inventory;
using PawCare.Api.Modules.Cart;
using PawCare.Api.Modules.Orders;
using PawCare.Api.Modules.Payments;
using PawCare.Api.Modules.Fulfillment;
using PawCare.Api.Modules.Media;
using PawCare.Api.Modules.Notifications;
using PawCare.Api.Modules.Moderation;
using PawCare.Api.Modules.Admin;
using PawCare.Api.Modules.Reports;

namespace PawCare.Api.Modules;
/// <summary>One explicit registration point; call once before builder.Build().</summary>
public static class ModuleRegistration
{
    public static IServiceCollection AddPawCareFeatureModules(this IServiceCollection services)
    {
        services.AddScoped<ModuleDb>();
        services.AddScoped<AuthRepository>();services.AddScoped<AuthService>();
        services.AddScoped<UsersRepository>();services.AddScoped<UsersService>();
        services.AddScoped<PetRepository>();services.AddScoped<PetService>();
        services.AddScoped<MedicalRepository>();services.AddScoped<MedicalService>();
        services.AddScoped<CareRepository>();services.AddScoped<CareService>();
        services.AddScoped<BookingRepository>();services.AddScoped<BookingService>();
        services.AddScoped<ExpenseRepository>();services.AddScoped<ExpenseService>();
        services.AddScoped<AdoptionRepository>();services.AddScoped<AdoptionService>();services.AddScoped<HandoverService>();
        services.AddScoped<DonationRepository>();services.AddScoped<DonationService>();
        services.AddScoped<MarketplaceRepository>();services.AddScoped<MarketplaceService>();
        services.AddScoped<SellerVerificationService>();
        services.AddScoped<LostFoundRepository>();services.AddScoped<LostFoundService>();
        services.AddScoped<CatalogRepository>();services.AddScoped<CatalogService>();
        services.AddScoped<InventoryRepository>();services.AddScoped<InventoryService>();
        services.AddScoped<CartRepository>();services.AddScoped<CartService>();
        services.AddScoped<OrderRepository>();services.AddScoped<CheckoutService>();
        services.AddScoped<WebhookVerifier>();services.AddScoped<PaymentService>();
        services.AddScoped<FulfillmentService>();services.AddScoped<MediaService>();
        services.AddScoped<NotificationService>();services.AddScoped<ModerationService>();
        services.AddScoped<AdminService>();services.AddScoped<ReportsService>();
        return services;
    }
    public static IEndpointRouteBuilder MapPawCareFeatureModules(this IEndpointRouteBuilder app)
    {
        app.MapAuthEndpoints();app.MapUsersEndpoints();app.MapPetEndpoints();
        app.MapMedicalEndpoints();app.MapCareEndpoints();app.MapAppointmentEndpoints();
        app.MapExpenseEndpoints();app.MapAdoptionEndpoints();app.MapDonationEndpoints();
        app.MapMarketplaceEndpoints();app.MapLostFoundEndpoints();app.MapCatalogEndpoints();
        app.MapInventoryEndpoints();app.MapCartEndpoints();app.MapOrderEndpoints();
        app.MapPaymentEndpoints();app.MapShipmentEndpoints();app.MapMediaEndpoints();
        app.MapNotificationEndpoints();app.MapModerationEndpoints();app.MapAdminEndpoints();
        app.MapReportsEndpoints();
        return app;
    }
}
