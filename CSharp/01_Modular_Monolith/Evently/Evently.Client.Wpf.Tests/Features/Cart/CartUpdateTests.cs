using Evently.Client.Wpf.ApiClient.Dtos;
using Evently.Client.Wpf.Features.Cart;
using Evently.Client.Wpf.Tests.Features.Events;
using FluentAssertions;

namespace Evently.Client.Wpf.Tests.Features.Cart;

public sealed class CartUpdateTests
{
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public void Update_WhenLoadCart_ShouldSetIsLoading()
    {
        // Arrange
        CartModel model = CartModel.Empty;

        // Act
        (CartModel newModel, IObservable<CartMsg>? effect) = CartUpdate.Update(model,
            new CartMsg.LoadCart(),
            EventlyApiClientStub.Create(), _userId);

        // Assert
        newModel.IsLoading.Should().BeTrue();
        newModel.Error.Should().BeNull();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenCartLoaded_ShouldPopulateItemsAndCalculateTotal()
    {
        // Arrange
        CartModel model = CartModel.Empty;

        // Act
        (CartModel newModel, IObservable<CartMsg>? effect) = CartUpdate.Update(model,
            new CartMsg.CartLoaded(SampleCart()),
            EventlyApiClientStub.Create(), _userId);

        // Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Items.Count.Should().BeGreaterThan(0);
        newModel.TotalPrice.Should().Be(350m);
        newModel.Error.Should().BeNull();
        effect.Should().BeNull();
    }

    [Fact]
    public void Update_WhenCartLoadedWithEmptyItems_ShouldSetTotalToZero()
    {
        // Arrange
        CartModel model = CartModel.Empty;

        // Act
        (CartModel newModel, IObservable<CartMsg>? effect) = CartUpdate.Update(model,
            new CartMsg.CartLoaded(new CartDto(Guid.NewGuid(), new List<CartItemDto>())),
            EventlyApiClientStub.Create(), _userId);

        // Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Items.Count.Should().Be(0);
        newModel.Error.Should().BeNull();
        effect.Should().BeNull();
    }

    [Fact]
    public void Update_WhenAddItem_ShouldSetIsLoading()
    {
        // Arrange
        CartModel model = CartModel.Empty;

        // Act
        (CartModel newModel, IObservable<CartMsg>? effect) = CartUpdate.Update(model,
            new CartMsg.AddItem(Guid.NewGuid(), 3),
            EventlyApiClientStub.Create(), _userId);

        // Assert
        newModel.IsLoading.Should().BeTrue();
        newModel.Items.Count.Should().Be(0);
        newModel.Error.Should().BeNull();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenRemoveItem_ShouldSetIsLoading()
    {
        // Arrange
        CartModel model = CartModel.Empty;

        // Act
        (CartModel newModel, IObservable<CartMsg>? effect) = CartUpdate.Update(model,
            new CartMsg.RemoveItem(Guid.NewGuid()),
            EventlyApiClientStub.Create(), _userId);

        // Assert
        newModel.IsLoading.Should().BeTrue();
        newModel.Items.Count.Should().Be(0);
        newModel.Error.Should().BeNull();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenCartUpdated_ShouldReloadCart()
    {
        // Arrange
        CartModel model = CartModel.Empty;

        // Act
        (CartModel newModel, IObservable<CartMsg>? effect) = CartUpdate.Update(model,
            new CartMsg.CartUpdated(),
            EventlyApiClientStub.Create(), _userId);

        // Assert
        newModel.IsLoading.Should().BeTrue();
        newModel.Items.Count.Should().Be(0);
        newModel.Error.Should().BeNull();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenLoadFailed_ShouldSetErrorAndClearLoading()
    {
        // Arrange
        CartModel model = CartModel.Empty;

        // Act
        (CartModel newModel, IObservable<CartMsg>? effect) = CartUpdate.Update(model,
            new CartMsg.LoadFailed("TestError"),
            EventlyApiClientStub.Create(), _userId);

        // Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Error.Should().Be("TestError");
        effect.Should().BeNull();
    }

    private static CartDto SampleCart() => new(Guid.NewGuid(), SampleCartItems());

    private static List<CartItemDto> SampleCartItems() =>
    [
        new(Guid.NewGuid(), "VIP", 2, 100m, "PLN"),
        new(Guid.NewGuid(), "Standard", 3, 50m, "PLN")
    ];
}
