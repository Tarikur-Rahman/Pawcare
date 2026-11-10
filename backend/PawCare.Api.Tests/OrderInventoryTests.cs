using PawCare.Api.Common;
using Xunit;

namespace PawCare.Api.Tests;

/// <summary>Executable money/input invariants and opt-in real checkout/Oracle contracts.</summary>
public sealed class OrderInventoryTests
{
    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    public void CheckoutAmount_RejectsNonPositiveMinorUnits(long value)
    {
        var bag = new ValidationBag();
        Validators.MoneyMinor(value, "amountMinor", bag, allowZero: false);
        Assert.True(bag.HasErrors);
        Assert.Contains("amountMinor", bag.ToFieldErrors().Keys);
    }

    [Theory]
    [InlineData("bdt")]
    [InlineData("BD")]
    [InlineData("BDTT")]
    [InlineData("")]
    public void Currency_RejectsMalformedCode(string currency)
    {
        var bag = new ValidationBag();
        Validators.Currency(currency, "currency", bag);
        Assert.True(bag.HasErrors);
    }

    [Fact]
    public void ValidCurrencyShape_IsNotMistakenForProviderOrCurrencyApproval()
    {
        var bag = new ValidationBag();
        Validators.Currency("BDT", "currency", bag);
        Assert.False(bag.HasErrors);
        // ISO code support and minor-unit scale must be verified by checkout service.
    }

    [Fact]
    public async Task ConcurrentCheckout_OnlyOneReservesLastUnit()
    {
        using var scenario = ContractScenario.Open("order-last-unit");
        var (first, second) = await scenario.SendConcurrentAsync("buyerACheckout", "buyerBCheckout");
        Assert.Equal(1, new[] { first, second }.Count(x => x.Status is 200 or 201));
        Assert.Equal(1, new[] { first, second }.Count(x => x.Status == 409));
        var product = await scenario.SendAsync("readProductInventory");
        Assert.Equal(200, product.Status);
        Assert.True(product.RequiredInt64("data.availableQuantity") >= 0);
        Assert.Equal(0, product.RequiredInt64("data.availableQuantity"));
    }

    [Fact]
    public async Task CheckoutIdempotency_SamePayloadDoesNotCreateAnotherOrder()
    {
        using var scenario = ContractScenario.Open("order-idempotent-checkout");
        var first = await scenario.SendAsync("checkoutOriginal");
        Assert.Contains(first.Status, new[] { 200, 201 });
        var repeat = await scenario.SendAsync("checkoutIdenticalReplay");
        Assert.Contains(repeat.Status, new[] { 200, 201 });
        Assert.Equal(first.RequiredString("data.id"), repeat.RequiredString("data.id"));
        var altered = await scenario.SendAsync("checkoutAlteredReplay");
        Assert.Equal(409, altered.Status);
        var list = await scenario.SendAsync("readExactTestOrders");
        Assert.Equal(1, list.RequiredInt64("total"));
    }

    [Fact]
    public async Task UnverifiedPayment_DoesNotBecomeCapturedOrPaid()
    {
        using var scenario = ContractScenario.Open("order-pending-payment");
        var checkout = await scenario.SendAsync("checkout");
        Assert.Contains(checkout.Status, new[] { 200, 201 });
        var read = await scenario.SendAsync("buyerReadOrder");
        Assert.Equal(200, read.Status);
        Assert.NotEqual("PAID", read.RequiredString("data.status"));
        Assert.NotEqual("CAPTURED", read.RequiredString("data.paymentStatus"));
    }

    [Fact]
    public async Task ExpiredUnpaidReservation_IsReleasedOnlyOnce()
    {
        using var scenario = ContractScenario.Open("order-expired-reservation");
        // Fixture provisions an expired unpaid reservation and enables the real reconciliation worker.
        // Poll only the isolated test deployment; do not invoke a simulated worker here.
        var stockBefore = await scenario.SendAsync("readBefore");
        Assert.Equal(200, stockBefore.Status);
        var initial = stockBefore.RequiredInt64("data.reservedQuantity");
        Assert.True(initial > 0);
        var timeout = DateTimeOffset.UtcNow.AddSeconds(25);
        ContractReply stockAfter;
        do
        {
            await Task.Delay(TimeSpan.FromSeconds(2));
            stockAfter = await scenario.SendAsync("readAfter");
        }
        while (stockAfter.RequiredInt64("data.reservedQuantity") >= initial &&
               DateTimeOffset.UtcNow < timeout);

        Assert.Equal(initial - 1, stockAfter.RequiredInt64("data.reservedQuantity"));
        var afterOrder = await scenario.SendAsync("readOrder");
        Assert.Equal("CANCELLED", afterOrder.RequiredString("data.status"));
        await Task.Delay(TimeSpan.FromSeconds(3));
        var repeat = await scenario.SendAsync("readAfter");
        Assert.Equal(stockAfter.RequiredInt64("data.reservedQuantity"),
            repeat.RequiredInt64("data.reservedQuantity"));
    }
}
